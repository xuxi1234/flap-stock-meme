import test from 'node:test';import assert from 'node:assert/strict';import ganache from 'ganache';import {BrowserProvider,ContractFactory,parseEther} from 'ethers';import {compile} from './compile.mjs';
test('direct VRF caps fees, preserves FIFO under out-of-order callbacks, and retains mint/referral/market economics',async()=>{
 const art=compile(),rpc=ganache.provider({logging:{quiet:true},chain:{hardfork:'shanghai'}}),p=new BrowserProvider(rpc,undefined,{cacheTimeout:-1});p.pollingInterval=10;
 try{const owner=await p.getSigner(0),buyer=await p.getSigner(1),inviter=await(await p.getSigner(2)).getAddress();
 const deploy=async(file,name,args=[])=>{const a=art[file][name],c=await new ContractFactory(a.abi,a.evm.bytecode.object,owner).deploy(...args);await c.waitForDeployment();return c;};
 const w=await deploy('test/DirectFixture.sol','DirectWrapperMock'),a=await deploy('src/ButterflyDirectVRF.sol','ButterflyDirectVRF',[await w.getAddress()]),n=await deploy('src/ButterflyNFT.sol','ButterflyNFT',[await a.getAddress(),'https://example.org/nft/']),m=await deploy('src/ButterflyMarket.sol','ButterflyMarket',[await n.getAddress()]);
 await(await a.bindCollection(await n.getAddress())).wait();const mint=q=>n['requestMint(uint256,address)'](q,inviter,{value:parseEther('0.01')*BigInt(q),gasLimit:2000000});
 await assert.rejects(async()=>await(await mint(1)).wait());assert.equal(await n.reserved(),0n);
 await(await a.fundOracle({value:parseEther('0.001')})).wait();await(await w.setFee(parseEther('0.00011'))).wait();await assert.rejects(async()=>await(await mint(1)).wait());assert.equal(await n.reserved(),0n);
 await(await w.setFee(parseEther('0.00002'))).wait();await(await mint(20)).wait();await(await mint(1)).wait();
 await assert.rejects(a.rawFulfillRandomWords(1,[0]));await assert.rejects(a.connect(buyer).bindCollection(await n.getAddress()));
 await(await w.fulfill(await a.getAddress(),2,0,{gasLimit:180000})).wait();await assert.rejects(a.finalize());
 const callback=await(await w.fulfill(await a.getAddress(),1,12345,{gasLimit:180000})).wait();assert.ok(callback.gasUsed<130000n);assert.equal(await n.assigned(),0n);
 await(await a.connect(buyer).finalize({gasLimit:1800000})).wait();await(await a.finalize({gasLimit:300000})).wait();const ids=[...await n.requestTokenIds(1),...await n.requestTokenIds(2)];assert.equal(new Set(ids.map(String)).size,21);
 await assert.rejects(w.fulfill(await a.getAddress(),1,5));await assert.rejects(a.finalize());
 await(await n.claim(1,await owner.getAddress(),{gasLimit:4000000})).wait();assert.equal(await n.balanceOf(await owner.getAddress()),20n);assert.equal(await n.referralRewards(inviter),parseEther('0.04'));assert.equal(await a.oracleBalance(),parseEther('0.00096'));
 const id=ids[0];await(await n.approve(await m.getAddress(),id)).wait();await(await m.list(id,parseEther('0.002'))).wait();await(await m.connect(buyer).buy(id,await owner.getAddress(),1,{value:parseEther('0.002')})).wait();assert.equal(await n.ownerOf(id),await buyer.getAddress());assert.equal(await m.FEE_BPS(),0n);
 }finally{await rpc.disconnect();await p.destroy();}
});
