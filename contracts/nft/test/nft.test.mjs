import test from 'node:test';
import assert from 'node:assert/strict';
import ganache from 'ganache';
import {BrowserProvider, ContractFactory, parseEther, ZeroAddress, id} from 'ethers';
import {compile} from './compile.mjs';
const price=parseEther('0.01');
let compiled;
async function fixture() {
 compiled ??= compile();
 const rpc=ganache.provider({logging:{quiet:true},wallet:{totalAccounts:4},chain:{hardfork:'shanghai'}});
 const provider=new BrowserProvider(rpc); provider.pollingInterval=10;
 const [owner,buyer,other]=await Promise.all([0,1,2].map(n=>provider.getSigner(n)));
 async function deploy(file,name,args=[]) {const c=compiled[file][name];const x=await new ContractFactory(c.abi,c.evm.bytecode.object,owner).deploy(...args);await x.waitForDeployment();return x;}
 const coordinator=await deploy('test/Fixtures.sol','Coordinator');
 const adapter=await deploy('src/ButterflyVRF.sol','ButterflyVRF',[await coordinator.getAddress(),id('key'),1,3,300000]);
 const collection=await deploy('src/ButterflyNFT.sol','ButterflyNFT',[await adapter.getAddress(),'ipfs://collection/']);
 await (await adapter.bindCollection(await collection.getAddress())).wait();
 const market=await deploy('src/ButterflyMarket.sol','ButterflyMarket',[await collection.getAddress()]);
 return {rpc,provider,owner,buyer,other,deploy,coordinator,adapter,collection,market};
}
test('required production contracts exist before behavioral tests',()=>{ compiled=compile(); assert.ok(compiled['src/ButterflyNFT.sol'],'NFT implementation is required'); });
test('paid mint reserves, callbacks assign without minting; payer claims atomically',async()=>{
 const f=await fixture();try{
 const {collection:c,coordinator:v,adapter:a,owner,buyer,provider}=f;
 await assert.rejects(c.requestMint({value:price-1n}));
 await (await c.requestMint({value:price})).wait();
 assert.equal(await c.reserved(),1n);
 await assert.rejects(c.claim(1,await owner.getAddress()));
 await assert.rejects(a.rawFulfillRandomWords(1,[7]));
 await (await v.fulfill(await a.getAddress(),1,7)).wait();
 assert.equal((await c.requests(1)).tokenId,8n);
 await assert.rejects(c.ownerOf(8));
 await assert.rejects(c.connect(buyer).claim(1,await buyer.getAddress()));
 const before=BigInt(await provider.send('eth_getBalance',[await c.TREASURY(),'latest']));
 await (await c.claim(1,await buyer.getAddress())).wait();
 assert.equal(await c.ownerOf(8),await buyer.getAddress());
 assert.equal(BigInt(await provider.send('eth_getBalance',[await c.TREASURY(),'latest']))-before,price);
 await assert.rejects(c.claim(1,await owner.getAddress()));
 await assert.rejects(v.fulfill(await a.getAddress(),1,7));
 }finally{await f.rpc.disconnect();}
});
test('repeated words allocate unique IDs, and receiver rejection leaves claim retriable',async()=>{
 const f=await fixture();try{
 const {collection:c,coordinator:v,adapter:a,owner,deploy}=f;
 for(let n=1;n<=3;n++){await(await c.requestMint({value:price})).wait();await(await v.fulfill(await a.getAddress(),n,0)).wait();}
 assert.deepEqual(await Promise.all([1,2,3].map(async n=>(await c.requests(n)).tokenId)),[1n,7777n,7776n]);
 const reject=await deploy('test/Fixtures.sol','RejectNFT');
 await assert.rejects(c.claim(1,await reject.getAddress()));
 assert.equal((await c.requests(1)).claimed,false);
 await(await c.claim(1,await owner.getAddress())).wait();
 }finally{await f.rpc.disconnect();}
});
test('escrow enforces seller cancellation, exact payment, no self-buy; splits 93/7',async()=>{
 const f=await fixture();try{
 const {collection:c,coordinator:v,adapter:a,owner,buyer,market:m,provider}=f;
 await(await c.requestMint({value:price})).wait();await(await v.fulfill(await a.getAddress(),1,0)).wait();await(await c.claim(1,await owner.getAddress())).wait();
 await(await c.approve(await m.getAddress(),1)).wait();await(await m.list(1,10000)).wait();
 assert.equal(await c.ownerOf(1),await m.getAddress());
 await assert.rejects(m.connect(buyer).cancel(1));await assert.rejects(m.buy(1,{value:10000}));await assert.rejects(m.connect(buyer).buy(1,{value:9999}));
 const sellerBefore=BigInt(await provider.send('eth_getBalance',[await owner.getAddress(),'latest']));
 const feeBefore=BigInt(await provider.send('eth_getBalance',[await m.TREASURY(),'latest']));
 await(await m.connect(buyer).buy(1,{value:10000})).wait();
 assert.equal(await c.ownerOf(1),await buyer.getAddress());
 assert.equal(BigInt(await provider.send('eth_getBalance',[await owner.getAddress(),'latest']))-sellerBefore,9300n);
 assert.equal(BigInt(await provider.send('eth_getBalance',[await m.TREASURY(),'latest']))-feeBefore,700n);
 await(await c.connect(buyer).approve(await m.getAddress(),1)).wait();await(await m.connect(buyer).list(1,10000)).wait();await(await m.connect(buyer).cancel(1)).wait();assert.equal(await c.ownerOf(1),await buyer.getAddress());
 }finally{await f.rpc.disconnect();}
});
test('all 7777 pending reservations consume capacity before any fulfillment',async()=>{
 const f=await fixture();try{
 const {collection:c,deploy}=f;const batch=await deploy('test/Fixtures.sol','BatchRequester');
 for(let n=0;n<77;n++) await(await batch.reserve(await c.getAddress(),100,{value:parseEther('1'),gasLimit:20000000})).wait();
 await(await batch.reserve(await c.getAddress(),77,{value:parseEther('0.77'),gasLimit:20000000})).wait();
 assert.equal(await c.reserved(),7777n);assert.equal(await c.assigned(),0n);assert.equal(await c.minted(),0n);
 await assert.rejects(c.requestMint({value:price}));
 }finally{await f.rpc.disconnect();}
});
test('treasury rejection cannot break fulfillment and reverted claim remains retriable',async()=>{
 const f=await fixture();try{
 const {collection:c,coordinator:v,adapter:a,owner,provider}=f;
 await(await c.requestMint({value:price})).wait();
 await provider.send('evm_setAccountCode',[await c.TREASURY(),'0x60006000fd']);
 await(await v.fulfill(await a.getAddress(),1,3)).wait();
 await assert.rejects(c.claim(1,await owner.getAddress()));assert.equal((await c.requests(1)).claimed,false);assert.equal(await c.minted(),0n);
 await provider.send('evm_setAccountCode',[await c.TREASURY(),'0x']);
 await(await c.claim(1,await owner.getAddress(),{gasLimit:200000})).wait();assert.equal(await c.ownerOf(4),await owner.getAddress());
 }finally{await f.rpc.disconnect();}
});
test('unconfigured adapters fail closed and binding cannot be changed',async()=>{
 const f=await fixture();try{
 const {adapter:a,collection:c,deploy,coordinator:v,buyer}=f;
 await assert.rejects(async()=>{await(await a.bindCollection(await c.getAddress())).wait();});await assert.rejects(a.connect(buyer).request());
 await assert.rejects(deploy('src/ButterflyVRF.sol','ButterflyVRF',[ZeroAddress,id('key'),1,3,300000]));
 const b=await deploy('src/ButterflyVRF.sol','ButterflyVRF',[await v.getAddress(),id('key'),1,3,300000]);
 const unbound=await deploy('src/ButterflyNFT.sol','ButterflyNFT',[await b.getAddress(),'ipfs://x/']);
 await assert.rejects(unbound.requestMint({value:price}));assert.equal(await unbound.reserved(),0n);
 await assert.rejects(b.connect(buyer).bindCollection(await unbound.getAddress()));
 }finally{await f.rpc.disconnect();}
});
test('metadata URI matches generated JSON filename and rejects unminted tokens',async()=>{
 const f=await fixture();try{
 const {collection:c,coordinator:v,adapter:a,owner}=f;
 await assert.rejects(c.tokenURI(8));
 await(await c.requestMint({value:price})).wait();await(await v.fulfill(await a.getAddress(),1,7)).wait();
 await assert.rejects(c.tokenURI(8));
 await(await c.claim(1,await owner.getAddress())).wait();
 assert.equal(await c.tokenURI(8),'ipfs://collection/8.json');
 }finally{await f.rpc.disconnect();}
});
test('receiver cannot reenter a second otherwise-authorized claim',async()=>{
 const f=await fixture();try{
 const {collection:c,coordinator:v,adapter:a,deploy}=f;const actor=await deploy('test/Fixtures.sol','AdversarialReceiver');const addr=await actor.getAddress();
 for(let n=1;n<=2;n++){await(await actor.execute(await c.getAddress(),c.interface.encodeFunctionData('requestMint'),{value:price})).wait();await(await v.fulfill(await a.getAddress(),n,n)).wait();}
 await(await actor.configure(await c.getAddress(),c.interface.encodeFunctionData('claim',[2,addr]),false)).wait();
 await(await actor.execute(await c.getAddress(),c.interface.encodeFunctionData('claim',[1,addr]))).wait();
 assert.equal(await actor.attempted(),true);assert.equal(await actor.reentered(),false);assert.equal((await c.requests(2)).claimed,false);assert.equal(await c.minted(),1n);
 await(await actor.configure(ZeroAddress,'0x',false)).wait();
 await(await actor.execute(await c.getAddress(),c.interface.encodeFunctionData('claim',[2,addr]))).wait();assert.equal(await c.minted(),2n);
 }finally{await f.rpc.disconnect();}
});
test('seller payout cannot reenter cancellation; rejected payout restores sale escrow',async()=>{
 const f=await fixture();try{
 const {collection:c,coordinator:v,adapter:a,market:m,deploy,buyer}=f;const actor=await deploy('test/Fixtures.sol','AdversarialReceiver');const addr=await actor.getAddress();
 for(let n=1;n<=2;n++){
 await(await c.requestMint({value:price})).wait();await(await v.fulfill(await a.getAddress(),n,n-1)).wait();await(await c.claim(n,addr)).wait();
 await(await actor.execute(await c.getAddress(),c.interface.encodeFunctionData('approve',[await m.getAddress(),n]))).wait();await(await actor.execute(await m.getAddress(),m.interface.encodeFunctionData('list',[n,10000]))).wait();
 }
 await(await actor.configure(await m.getAddress(),m.interface.encodeFunctionData('cancel',[2]),false)).wait();
 await(await m.connect(buyer).buy(1,{value:10000})).wait();assert.equal(await actor.attempted(),true);assert.equal(await actor.reentered(),false);assert.equal((await m.listings(2)).seller,addr);
 await(await actor.configure(ZeroAddress,'0x',true)).wait();
 await assert.rejects(async()=>{await(await m.connect(buyer).buy(2,{value:10000})).wait();});
 assert.equal((await m.listings(2)).seller,addr);assert.equal(await c.ownerOf(2),await m.getAddress());
 }finally{await f.rpc.disconnect();}
});
