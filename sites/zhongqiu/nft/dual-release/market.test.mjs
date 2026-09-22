import test from 'node:test';import assert from 'node:assert/strict';
import ganache from 'ganache';import {BrowserProvider,Wallet,ContractFactory,parseEther,ZeroAddress} from 'ethers';
import {compile} from './compile.mjs';
const {market,output}=compile({'MarketFixture.sol':{content:`pragma solidity 0.8.30;import '@openzeppelin/contracts/token/ERC721/ERC721.sol';contract TestNFT is ERC721{constructor()ERC721('Fixture','FIX'){}function mint(address a,uint256 id)external{_mint(a,id);}}`}});
const raw=ganache.provider({logging:{quiet:true},chain:{chainId:56,hardfork:'shanghai'},wallet:{totalAccounts:4,defaultBalance:100}});
const provider=new BrowserProvider(raw);provider.pollingInterval=10;
const seller=await provider.getSigner(0),buyer=await provider.getSigner(1),other=await provider.getSigner(2);
const wallet=new Wallet(Object.values(raw.getInitialAccounts())[0].secretKey);
const wait=async x=>(await x).wait();
async function deploy(a,args=[]){const c=await new ContractFactory(a.abi,a.evm.bytecode.object,seller).deploy(...args);await c.waitForDeployment();return c;}
const c=await deploy(output.contracts['MarketFixture.sol'].TestNFT),r=await deploy(output.contracts['MarketFixture.sol'].TestNFT),alien=await deploy(output.contracts['MarketFixture.sol'].TestNFT);
const m=await deploy(market,[await c.getAddress(),await r.getAddress()]);
const domain={name:'Butterfly Mid-Autumn Market',version:'1',chainId:56,verifyingContract:await m.getAddress()};
const types={Order:[{name:'seller',type:'address'},{name:'collection',type:'address'},{name:'tokenId',type:'uint256'},{name:'price',type:'uint256'},{name:'deadline',type:'uint256'},{name:'salt',type:'uint256'}]};
await wait(c.mint(await seller.getAddress(),1));await wait(c.mint(await seller.getAddress(),2));await wait(c.setApprovalForAll(await m.getAddress(),true));
let salt=0;const order=(overrides={})=>({seller:wallet.address,collection:c.target,tokenId:1,price:parseEther('0.003'),deadline:2000000000,salt:++salt,...overrides});
async function register(o){const sig=await wallet.signTypedData(domain,types,o);await wait(m.register(o,sig));return m.hashOrder(o);}
await test('signed listing is visible to all; exact price atomically transfers NFT and full seller proceeds',async()=>{
 const o=order(),h=await register(o);assert(await m.isActive(h));assert.equal(await m.orderCount(),1n);
 await assert.rejects(m.connect(buyer).buy.staticCall(h,{value:o.price-1n}));
 const before=BigInt(await raw.request({method:'eth_getBalance',params:[wallet.address,'latest']}));
 await wait(m.connect(buyer).buy(h,{value:o.price}));assert.equal(await c.ownerOf(1),await buyer.getAddress());
 assert.equal(BigInt(await raw.request({method:'eth_getBalance',params:[wallet.address,'latest']}))-before,o.price);
 assert.equal(await m.isActive(h),false);assert.equal(await provider.getBalance(m.target),0n);
 await assert.rejects(m.connect(other).buy.staticCall(h,{value:o.price}));
});
await test('seller can cancel unpublished and published orders; other accounts cannot',async()=>{
 const o=order({tokenId:2}),h=await m.hashOrder(o);
 await assert.rejects(m.connect(other).cancel.staticCall(o));await wait(m.cancel(o));
 await assert.rejects(m.register.staticCall(o,await wallet.signTypedData(domain,types,o)));
 const p=order({tokenId:2}),hp=await register(p);await wait(m.cancel(p));assert.equal(await m.isActive(hp),false);
});
await test('wrong chain signatures, changed prices, unsupported collection and expired order are rejected',async()=>{
 const o=order({tokenId:2});const sig=await wallet.signTypedData(domain,types,o);
 await assert.rejects(m.register.staticCall({...o,price:o.price+1n},sig));
 await assert.rejects(m.register.staticCall(o,await wallet.signTypedData({...domain,chainId:1},types,o)));
 for(const patch of [{collection:alien.target},{deadline:1},{price:0},{seller:ZeroAddress}]){const x=order({tokenId:2,...patch});await assert.rejects(m.register.staticCall(x,await wallet.signTypedData(domain,types,x)));}
});
await test('revoked approval, transferred ownership, and expired listings cannot sell',async()=>{
 const o=order({tokenId:2}),h=await register(o);await wait(c.setApprovalForAll(m.target,false));assert.equal(await m.isActive(h),false);
 await wait(c.setApprovalForAll(m.target,true));await wait(c.transferFrom(wallet.address,await other.getAddress(),2));assert.equal(await m.isActive(h),false);
 await assert.rejects(m.connect(buyer).buy.staticCall(h,{value:o.price}));
 await wait(c.connect(other).transferFrom(await other.getAddress(),wallet.address,2));
 await raw.request({method:'evm_setTime',params:[new Date(2000000001000)]});await raw.request({method:'evm_mine',params:[]});assert.equal(await m.isActive(h),false);
});
await raw.disconnect();
