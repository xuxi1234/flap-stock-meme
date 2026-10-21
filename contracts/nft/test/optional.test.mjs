import test from 'node:test';
import assert from 'node:assert/strict';
import ganache from 'ganache';
import {BrowserProvider,ContractFactory,parseEther,ZeroAddress} from 'ethers';
import {compile} from './compile.mjs';
test('optional inviter: direct VRF, full treasury payout, late binding and immutable rewards',async()=>{
 const art=compile(),rpc=ganache.provider({logging:{quiet:true},chain:{hardfork:'shanghai'}}),p=new BrowserProvider(rpc,undefined,{cacheTimeout:-1});p.pollingInterval=10;
 try {
 const owner=await p.getSigner(0),inviter=await(await p.getSigner(1)).getAddress(),other=await(await p.getSigner(2)).getAddress(),payer=await owner.getAddress();
 const deploy=async(file,name,args=[])=>{const a=art[file][name],c=await new ContractFactory(a.abi,a.evm.bytecode.object,owner).deploy(...args);await c.waitForDeployment();return c;};
 const w=await deploy('test/DirectFixture.sol','DirectWrapperMock'),a=await deploy('src/ButterflyDirectVRF.sol','ButterflyDirectVRF',[await w.getAddress()]),n=await deploy('src/ButterflyNFT.sol','ButterflyNFT',[await a.getAddress(),'https://example.org/nft/']);
 await(await a.bindCollection(await n.getAddress())).wait();await(await a.fundOracle({value:parseEther('0.001')})).wait();
 assert.equal(await n.OPTIONAL_REFERRER(),true);
 await(await n['requestMint()']({value:parseEther('0.01')})).wait();
 await(await n['requestMint(uint256,address)'](20,ZeroAddress,{value:parseEther('0.2')})).wait();
 assert.equal(await n.referrers(payer),ZeroAddress);
 // Binding later must not retroactively create rewards for the first two requests.
 await(await n['requestMint(uint256,address)'](1,inviter,{value:parseEther('0.01')})).wait();
 await(await n['requestMint(uint256,address)'](1,ZeroAddress,{value:parseEther('0.01')})).wait();
 assert.equal((await n.requests(4)).referrer,inviter);
 await assert.rejects(n['requestMint(uint256,address)'](1,other,{value:parseEther('0.01')}));
 const balance=async()=>BigInt(await p.send('eth_getBalance',[await n.TREASURY(),'latest']));
 const before=await balance();
 for(let id=1;id<=4;id++) {await(await w.fulfill(await a.getAddress(),id,123+id,{gasLimit:180000})).wait();await(await a.finalize({gasLimit:1800000})).wait();await(await n.claim(id,payer,{gasLimit:4000000})).wait();}
 assert.equal(await balance()-before,parseEther('0.226'));
 assert.equal(await n.balanceOf(payer),23n);assert.equal(await n.referralRewards(ZeroAddress),0n);assert.equal(await n.referralMintCount(ZeroAddress),0n);assert.equal(await n.invitedCount(ZeroAddress),0n);
 assert.equal(await n.referralRewards(inviter),parseEther('0.004'));assert.equal(await n.invitedCount(inviter),1n);
 await assert.rejects(n.claim(1,payer));
 }finally{await rpc.disconnect();await p.destroy();}
});
