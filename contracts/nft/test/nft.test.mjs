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
test('noncustodial sale enforces exact payment and pays seller all 0.15777 BNB',async()=>{
 const f=await fixture();try{
 const {collection:c,coordinator:v,adapter:a,owner,buyer,market:m,provider}=f;
 await(await c.requestMint({value:price})).wait();await(await v.fulfill(await a.getAddress(),1,0)).wait();await(await c.claim(1,await owner.getAddress())).wait();
 await(await c.approve(await m.getAddress(),1)).wait();const salePrice=parseEther('0.15777');await(await m.list(1,salePrice)).wait();
 assert.equal(await c.ownerOf(1),await owner.getAddress());
 assert.equal(await m.FEE_BPS(),0n);
 await assert.rejects(m.connect(buyer).cancel(1));await assert.rejects(m.buy(1,await owner.getAddress(),1,{value:salePrice}));await assert.rejects(m.connect(buyer).buy(1,await owner.getAddress(),1,{value:9999}));
 const sellerBefore=BigInt(await provider.send('eth_getBalance',[await owner.getAddress(),'latest']));
 const feeBefore=BigInt(await provider.send('eth_getBalance',[await m.TREASURY(),'latest']));
 await(await m.connect(buyer).buy(1,await owner.getAddress(),1,{value:salePrice})).wait();
 assert.equal(await c.ownerOf(1),await buyer.getAddress());
 assert.equal(BigInt(await provider.send('eth_getBalance',[await owner.getAddress(),'latest']))-sellerBefore,salePrice);
 assert.equal(BigInt(await provider.send('eth_getBalance',[await m.TREASURY(),'latest']))-feeBefore,0n);
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
 await(await c.claim(1,await owner.getAddress(),{gasLimit:350000})).wait();assert.equal(await c.ownerOf(4),await owner.getAddress());
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
test('seller payout cannot reenter cancellation; rejected payout restores ownership and listing',async()=>{
 const f=await fixture();try{
 const {collection:c,coordinator:v,adapter:a,market:m,deploy,buyer}=f;const actor=await deploy('test/Fixtures.sol','AdversarialReceiver');const addr=await actor.getAddress();
 for(let n=1;n<=2;n++){
 await(await c.requestMint({value:price})).wait();await(await v.fulfill(await a.getAddress(),n,n-1)).wait();await(await c.claim(n,addr)).wait();
 await(await actor.execute(await c.getAddress(),c.interface.encodeFunctionData('approve',[await m.getAddress(),n]))).wait();await(await actor.execute(await m.getAddress(),m.interface.encodeFunctionData('list',[n,10000]))).wait();
 }
 await(await actor.configure(await m.getAddress(),m.interface.encodeFunctionData('cancel',[2]),false)).wait();
 await(await m.connect(buyer).buy(1,addr,1,{value:10000})).wait();assert.equal(await actor.attempted(),true);assert.equal(await actor.reentered(),false);assert.equal((await m.listings(2)).seller,addr);
 await(await actor.configure(ZeroAddress,'0x',true)).wait();
 await assert.rejects(async()=>{await(await m.connect(buyer).buy(2,addr,1,{value:10000})).wait();});
 assert.equal((await m.listings(2)).seller,addr);assert.equal(await c.ownerOf(2),addr);assert.equal(await m.isListingActive(2),true);
 }finally{await f.rpc.disconnect();}
});

test('enumeration and bounded payer request pages survive claims and transfers',async()=>{
 const f=await fixture();try{
 const {collection:c,coordinator:v,adapter:a,owner,buyer}=f;const own=await owner.getAddress(),buy=await buyer.getAddress();
 for(let n=1;n<=3;n++){await(await c.requestMint({value:price})).wait();await(await v.fulfill(await a.getAddress(),n,n-1)).wait();await(await c.claim(n,own)).wait();}
 assert.equal(await c.totalSupply(),3n);assert.equal(await c.payerRequestCount(own),3n);
 assert.deepEqual(Array.from(await c.payerRequests(own,1,2)),[2n,3n]);assert.deepEqual(Array.from(await c.payerRequests(own,100,2)),[]);
 await assert.rejects(c.payerRequests(own,0,101));assert.equal(await c.supportsInterface('0x780e9d63'),true);assert.equal(await c.supportsInterface('0x2a55205a'),false);
 await(await c.transferFrom(own,buy,2)).wait();assert.equal(await c.tokenOfOwnerByIndex(buy,0),2n);assert.equal(await c.balanceOf(own),2n);
 assert.deepEqual(new Set(await Promise.all([0,1,2].map(i=>c.tokenByIndex(i)))),new Set([1n,2n,3n]));
 assert.equal(await c.contractURI(),'ipfs://collection/collection.json');
 }finally{await f.rpc.disconnect();}
});
test('revoked approvals disable sale; ownership roundtrip never resurrects listing',async()=>{
 const f=await fixture();try{
 const {collection:c,coordinator:v,adapter:a,owner,buyer,market:m}=f;const own=await owner.getAddress(),buy=await buyer.getAddress();
 await(await c.requestMint({value:price})).wait();await(await v.fulfill(await a.getAddress(),1,0)).wait();await(await c.claim(1,own)).wait();
 await(await c.approve(await m.getAddress(),1)).wait();await(await m.list(1,10000)).wait();assert.equal(await m.isListingActive(1),true);
 await(await c.approve(ZeroAddress,1)).wait();assert.equal(await m.isListingActive(1),false);await assert.rejects(m.connect(buyer).buy(1,own,1,{value:10000}));
 await(await c.setApprovalForAll(await m.getAddress(),true)).wait();assert.equal(await m.isListingActive(1),true);
 const nonce=await c.transferNonce(1);await(await c.transferFrom(own,buy,1)).wait();await(await c.connect(buyer).transferFrom(buy,own,1)).wait();
 assert.equal(await c.transferNonce(1),nonce+2n);assert.equal(await m.isListingActive(1),false);await assert.rejects(m.connect(buyer).buy(1,own,1,{value:10000}));
 await(await m.list(1,10001)).wait();assert.equal(await m.isListingActive(1),true);const beforeCancel=await c.transferNonce(1);
 assert.equal(await m.listedTokenCount(),1n);assert.deepEqual(Array.from(await m.listedTokenIds(0,100)),[1n]);await assert.rejects(m.listedTokenIds(0,101));assert.deepEqual(Array.from(await m.listedTokenIds(1,100)),[]);
 await(await m.cancel(1)).wait();assert.equal(await m.listedTokenCount(),1n);assert.equal(await c.transferNonce(1),beforeCancel);assert.equal(await c.ownerOf(1),own);assert.equal(await m.isListingActive(1),false);
 }finally{await f.rpc.disconnect();}
});
test('buyer receiver reentry is blocked',async()=>{
 const f=await fixture();try{
 const {collection:c,coordinator:v,adapter:a,owner,market:m,deploy}=f;const own=await owner.getAddress();
 await(await c.requestMint({value:price})).wait();await(await v.fulfill(await a.getAddress(),1,0)).wait();await(await c.claim(1,own)).wait();
 await(await c.approve(await m.getAddress(),1)).wait();await(await m.list(1,10000)).wait();
 const actor=await deploy('test/Fixtures.sol','AdversarialReceiver');
 await(await actor.configure(await m.getAddress(),m.interface.encodeFunctionData('list',[1,5]),false)).wait();
 await(await actor.execute(await m.getAddress(),m.interface.encodeFunctionData('buy',[1,own,1]),{value:10000})).wait();
 assert.equal(await actor.attempted(),true);assert.equal(await actor.reentered(),false);assert.equal(await c.ownerOf(1),await actor.getAddress());
 }finally{await f.rpc.disconnect();}
});
test('rejected buyer receiver restores seller NFT, approval and listing',async()=>{
 const f=await fixture();try{
 const {collection:c,coordinator:v,adapter:a,owner,market:m,deploy}=f;const own=await owner.getAddress();
 await(await c.requestMint({value:price})).wait();await(await v.fulfill(await a.getAddress(),1,0)).wait();await(await c.claim(1,own)).wait();
 await(await c.approve(await m.getAddress(),1)).wait();await(await m.list(1,10000)).wait();
 const bad=await deploy('test/Fixtures.sol','RejectingBuyer');const nonce=await c.transferNonce(1);
 await assert.rejects(bad.buy(await m.getAddress(),1,own,1,{value:10000}));
 assert.equal(await c.ownerOf(1),own);assert.equal(await m.isListingActive(1),true);assert.equal(await c.transferNonce(1),nonce);
 }finally{await f.rpc.disconnect();}
});

test('buy binds the reviewed listing version across cancellation and same-price relisting',async()=>{
 const f=await fixture();try{
 const {collection:c,coordinator:v,adapter:a,owner,buyer,market:m}=f;const own=await owner.getAddress();
 await(await c.requestMint({value:price})).wait();await(await v.fulfill(await a.getAddress(),1,0)).wait();await(await c.claim(1,own)).wait();
 await(await c.approve(await m.getAddress(),1)).wait();await(await m.list(1,10000)).wait();const reviewed=await m.listingVersion(1);assert.equal(reviewed,1n);
 await(await m.cancel(1)).wait();assert.equal(await m.listingVersion(1),reviewed);
 await(await m.list(1,10000)).wait();assert.equal(await m.listingVersion(1),reviewed+1n);
 await assert.rejects(m.connect(buyer).buy(1,own,reviewed,{value:10000}));assert.equal(await c.ownerOf(1),own);assert.equal(await m.isListingActive(1),true);
 await(await m.connect(buyer).buy(1,own,reviewed+1n,{value:10000})).wait();assert.equal(await c.ownerOf(1),await buyer.getAddress());assert.equal(await m.listingVersion(1),reviewed+1n);
 assert.equal(m.interface.getFunction('buy(uint256)'),null,'unbound buy selector is not available');
 }finally{await f.rpc.disconnect();}
});
test('buy cannot accept a replacement seller at the reviewed price',async()=>{
 const f=await fixture();try{
 const {collection:c,coordinator:v,adapter:a,owner,buyer,other,market:m}=f;const own=await owner.getAddress(),next=await other.getAddress();
 await(await c.requestMint({value:price})).wait();await(await v.fulfill(await a.getAddress(),1,0)).wait();await(await c.claim(1,own)).wait();
 await(await c.approve(await m.getAddress(),1)).wait();await(await m.list(1,10000)).wait();const reviewed=await m.listingVersion(1);
 await(await c.transferFrom(own,next,1)).wait();await(await c.connect(other).approve(await m.getAddress(),1)).wait();await(await m.connect(other).list(1,10000)).wait();
 const current=await m.listingVersion(1);assert.equal(current,reviewed+1n);
 await assert.rejects(m.connect(buyer).buy(1,own,reviewed,{value:10000}));
 await assert.rejects(m.connect(buyer).buy(1,own,current,{value:10000}));
 await assert.rejects(m.connect(buyer).buy(1,next,reviewed,{value:10000}));
 assert.equal(await c.ownerOf(1),next);assert.equal(await m.isListingActive(1),true);
 await(await m.connect(buyer).buy(1,next,current,{value:10000})).wait();assert.equal(await c.ownerOf(1),await buyer.getAddress());
 }finally{await f.rpc.disconnect();}
});
