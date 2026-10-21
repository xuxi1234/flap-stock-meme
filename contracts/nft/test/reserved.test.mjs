import test from 'node:test';
import assert from 'node:assert/strict';
import ganache from 'ganache';
import {BrowserProvider,ContractFactory,parseEther,ZeroAddress} from 'ethers';
import {compile} from './compile.mjs';

test('four exact owners and complete 7773-ID pool without duplicates or reserved IDs',async()=>{
 const art=compile(),rpc=ganache.provider({logging:{quiet:true},chain:{hardfork:'shanghai'}}),p=new BrowserProvider(rpc,undefined,{cacheTimeout:-1});p.pollingInterval=10;
 try{
  const signer=await p.getSigner();
  const deploy=async(name,args=[])=>{const a=art['test/ReservedFixture.sol'][name],c=await new ContractFactory(a.abi,a.evm.bytecode.object,signer).deploy(...args);await c.waitForDeployment();return c;};
  const adapter=await deploy('ReservedAdapterMock'),n=await deploy('ReservedPoolHarness',[await adapter.getAddress()]);
  const recipient='0x1aee21A82300f315Bb3782dFb0330477C5b87C58',special=[1,520,1314,7777];
  for(const id of special){assert.equal(await n.ownerOf(id),recipient);assert.equal(await n.tokenURI(id),`https://example.org/nft/${id}.json`);}
  for(const method of ['reserved','assigned','minted','totalSupply'])assert.equal(await n[method](),4n);
  assert.equal(await n.balanceOf(recipient),4n);assert.equal(await n.PUBLIC_SUPPLY(),7773n);
  const seen=new Set(special);
  for(let offset=0;offset<7773;offset+=200){
   const count=Math.min(200,7773-offset),r=await(await n.drawBatch(count,offset,{gasLimit:9000000})).wait();
   const event=r.logs.map(l=>{try{return n.interface.parseLog(l)}catch{return null}}).find(l=>l?.name==='Drawn');
   assert.equal(event.args.ids.length,count);
   for(const raw of event.args.ids){const id=Number(raw);assert.ok(id>=1&&id<=7777);assert.ok(!seen.has(id),`Duplicate/reserved ${id}`);seen.add(id);}
  }
  assert.equal(seen.size,7777);assert.equal(await n.assigned(),7777n);
  await assert.rejects(n.drawBatch(1,0));
  const a=art['src/ButterflyReservedNFT.sol'].ButterflyReservedNFT;
  const production=await new ContractFactory(a.abi,a.evm.bytecode.object,signer).deploy(await adapter.getAddress(),'https://example.org/nft/');
  await production.waitForDeployment();
  const f=art['test/Fixtures.sol'].BatchRequester,batch=await new ContractFactory(f.abi,f.evm.bytecode.object,signer).deploy();await batch.waitForDeployment();
  for(let done=0;done<388;done+=40){const count=Math.min(40,388-done);await(await batch.reserve(await production.getAddress(),count,20,ZeroAddress,{value:parseEther('0.2')*BigInt(count),gasLimit:12000000})).wait();}
  await assert.rejects(production['requestMint(uint256,address)'](14,ZeroAddress,{value:parseEther('0.14')}));
  await(await production['requestMint(uint256,address)'](13,ZeroAddress,{value:parseEther('0.13')})).wait();
  assert.equal(await production.reserved(),7777n);
  await assert.rejects(production['requestMint()']({value:parseEther('0.01')}));
 }finally{await rpc.disconnect();await p.destroy();}
});
