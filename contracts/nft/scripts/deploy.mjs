// Read-only by default. No dotenv or shared credential loading.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import solc from 'solc';
import {Contract,ContractFactory,JsonRpcProvider,Wallet,getAddress,parseEther,formatEther,keccak256} from 'ethers';
import {compile} from '../test/compile.mjs';
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'));
const fail=m=>{throw new Error(m);};
export function validateMetadata(base){
 let u;try{u=new URL(base);}catch{fail('Absolute HTTPS/IPFS metadata URI required');}
 if(!['https:','ipfs:'].includes(u.protocol)||!u.hostname||u.username||u.password||u.search||u.hash||!u.pathname.endsWith('/'))fail('Metadata must be an absolute HTTPS/IPFS directory URI ending /');
 if(['localhost','example.com'].includes(u.hostname)||u.hostname.endsWith('.invalid'))fail('Use final published metadata origin');return base;
}
// Fail closed on shallow/reorganized receipts; callers may rerun once confirmations accrue.
export async function confirmedReceipt(provider,hash,recorded){
 const first=await provider.getTransactionReceipt(hash);
 if(!first||first.status!==1)fail('Missing or failed journal receipt; manual review required');
 if(recorded&&first.blockHash!==recorded.blockHash)fail('Noncanonical journal receipt');
 const head=await provider.getBlockNumber();
 if(head-first.blockNumber+1<3)fail('Journal transaction needs 3 confirmations before proceeding');
 // Reconcile canonical membership again after observing the confirmation height.
 const current=await provider.getTransactionReceipt(hash);
 if(!current||current.status!==1||current.blockHash!==first.blockHash||current.blockNumber!==first.blockNumber)fail('Receipt changed during confirmation check');
 return current;
}
export function frontendConfig({collection,market,collectionCode,marketCode,assetBase}){
 const nft=getAddress(collection),exchange=getAddress(market);
 if(nft===exchange||BigInt(nft)===0n||BigInt(exchange)===0n)fail('Invalid deployment addresses');
 if(!collectionCode||collectionCode==='0x'||!marketCode||marketCode==='0x')fail('Missing deployed code');
 validateMetadata(assetBase);if(!assetBase.startsWith('https://'))fail('NFT_ASSET_BASE must use HTTPS');
 return {enabled:false,chainId:56,collection:nft,market:exchange,collectionCodeHash:keccak256(collectionCode),marketCodeHash:keccak256(marketCode),assetBase,reason:'部署信息已生成；独立核验源码、字节码、随机数和图片托管后方可开启交易。'};
}
async function main(){
 const execute=process.argv.includes('--execute');
 const missing=['NFT_RPC_URL','NFT_SIGNER_ADDRESS','NFT_METADATA_BASE','NFT_ASSET_BASE','NFT_VRF_SUBSCRIPTION_ID','NFT_MAX_SPEND_BNB'].filter(k=>!process.env[k]);
 if(missing.length){console.log(JSON.stringify({mode:'check-only',ready:false,missing,notes:['No key loaded; no transactions sent.','Publish immutable metadata and JPEG images. Create a dedicated VRF v2.5 subscription and fund native BNB; signer must own it.']},null,2));if(execute)fail('Missing inputs');return;}
 const cfg=JSON.parse(fs.readFileSync('config/bsc-vrf.json','utf8'));
 const address=getAddress(process.env.NFT_SIGNER_ADDRESS),base=validateMetadata(process.env.NFT_METADATA_BASE),subId=BigInt(process.env.NFT_VRF_SUBSCRIPTION_ID),cap=parseEther(process.env.NFT_MAX_SPEND_BNB);
 const assetBase=validateMetadata(process.env.NFT_ASSET_BASE);if(!assetBase.startsWith('https://'))fail('NFT_ASSET_BASE must use HTTPS');
 if(subId<=0n||cap<=0n)fail('Positive subscription ID and explicit spend cap required');
 if(execute&&process.env.NFT_DEPLOY_CONFIRM!==`DEPLOY_BUTTERFLY_ON_56:${address}`)fail('Explicit NFT_DEPLOY_CONFIRM required');
 const p=new JsonRpcProvider(process.env.NFT_RPC_URL);
 if((await p.getNetwork()).chainId!==56n)fail('Only chain 56 supported');
 if(await p.getCode(cfg.coordinator)==='0x')fail('Missing coordinator code');
 const coordinator=new Contract(cfg.coordinator,['function getSubscription(uint256) view returns(uint96 balance,uint96 nativeBalance,uint64 reqCount,address owner,address[] consumers)','function addConsumer(uint256,address)','function getRequestConfig() view returns(uint16 minimumRequestConfirmations,uint32 maxGasLimit,bytes32[] provingKeyHashes)'],p);
 const oracle=await coordinator.getRequestConfig();
 if(!oracle.provingKeyHashes.includes(cfg.keyHash)||cfg.confirmations<Number(oracle.minimumRequestConfirmations)||cfg.callbackGasLimit>Number(oracle.maxGasLimit))fail('Pinned VRF configuration unsupported');
 const sub=await coordinator.getSubscription(subId);
 if(getAddress(sub.owner)!==address||sub.nativeBalance===0n)fail('Signer must own native-BNB-funded subscription');
 const compiled=compile(),compiler=solc.version();
 const sourceHash=createHash('sha256').update(JSON.stringify({compiler,optimizer:{enabled:true,runs:200},evmVersion:'shanghai',sources:Object.fromEntries(fs.readdirSync('src').sort().map(n=>[n,fs.readFileSync(`src/${n}`,'utf8')])),lock:fs.readFileSync('package-lock.json','utf8')})).digest('hex');
 const identity={chainId:56,address,base,assetBase,subId:subId.toString(),sourceHash,compiler,cfg};
 const filename=path.resolve(process.env.NFT_DEPLOY_JOURNAL||'deployment-56.json');
 const journal=fs.existsSync(filename)?JSON.parse(fs.readFileSync(filename,'utf8')):{identity,steps:{}};
 if(JSON.stringify(journal.identity)!==JSON.stringify(identity))fail('Journal source/compiler/configuration mismatch');
 const save=()=>{fs.writeFileSync(`${filename}.tmp`,JSON.stringify(journal,null,2));fs.renameSync(`${filename}.tmp`,filename);};
 let signer;
 if(execute){if(!process.env.NFT_DEPLOY_PRIVATE_KEY)fail('NFT-specific NFT_DEPLOY_PRIVATE_KEY required');signer=new Wallet(process.env.NFT_DEPLOY_PRIVATE_KEY,p);if(signer.address!==address)fail('Key does not match explicit signer');}
 const gasPrice=(await p.getFeeData()).gasPrice;if(!gasPrice)fail('Missing gas price');
 const limits={adapter:2000000n,collection:4000000n,market:2000000n,bind:150000n,consumer:200000n};
 let spent=Object.values(journal.steps).reduce((n,s)=>n+BigInt(s.costWei||0),0n);
 const bound=Object.entries(limits).filter(([k])=>!journal.steps[k]?.receipt).reduce((n,[,v])=>n+v*gasPrice,0n);
 if(spent+bound>cap)fail(`Conservative budget ${formatEther(spent+bound)} BNB exceeds cap`);
 if(await p.getBalance(address)<bound)fail('Insufficient signer gas balance');
 console.log(JSON.stringify({mode:execute?'execute':'check-only',identity,subscriptionNativeBNB:formatEther(sub.nativeBalance),gasPriceWei:gasPrice.toString(),remainingGasBoundBNB:formatEther(bound),capBNB:formatEther(cap)},null,2));
 async function step(name,request){
  let old=journal.steps[name];
  if(old?.hash){
   const r=await confirmedReceipt(p,old.hash,old.receipt);
   if(!old.receipt){old.receipt=r.toJSON();old.costWei=(r.gasUsed*r.gasPrice).toString();spent+=BigInt(old.costWei);if(execute)save();}
   return r.contractAddress;
  }
  if(old?.intent)fail(`Unresolved ${name} broadcast intent; inspect nonce before resuming`);
  const estimate=await p.estimateGas({...request,from:address}),gasLimit=estimate*120n/100n;
  if(gasLimit>limits[name])fail(`${name} estimate exceeds bound`);
  console.log(`${name}: estimated gas ${estimate}; bounded gas ${gasLimit}`);if(!execute)return null;
  if(spent+gasLimit*gasPrice>cap)fail('Cumulative cap exceeded');
  const nonce=await p.getTransactionCount(address,'pending');
  journal.steps[name]={intent:{nonce,to:request.to||null,dataHash:keccak256(request.data),gasLimit:gasLimit.toString(),gasPrice:gasPrice.toString()}};save();
  const tx=await signer.sendTransaction({...request,nonce,gasLimit,gasPrice,type:0,chainId:56});journal.steps[name].hash=tx.hash;save();
  await tx.wait(3);const r=await confirmedReceipt(p,tx.hash);journal.steps[name].receipt=r.toJSON();journal.steps[name].costWei=(r.gasUsed*r.gasPrice).toString();spent+=BigInt(journal.steps[name].costWei);save();if(r.status!==1)fail(`${name} reverted`);return r.contractAddress;
 }
 const artifact=n=>compiled[`src/${n}.sol`][n];
 async function deploy(label,name,args){const a=artifact(name);return step(label,await new ContractFactory(a.abi,a.evm.bytecode.object).getDeployTransaction(...args));}
 const adapter=await deploy('adapter','ButterflyVRF',[cfg.coordinator,cfg.keyHash,subId,cfg.confirmations,cfg.callbackGasLimit]);
 if(!adapter){console.log('Dependent estimates require deployed predecessors; conservative bounds cover all steps. Execute re-estimates before each send.');return;}
 if(await p.getCode(adapter)==='0x')fail('Journal adapter code missing');
 const collection=await deploy('collection','ButterflyNFT',[adapter,base]);if(!collection)return;
 const market=await deploy('market','ButterflyMarket',[collection]);if(!market)return;
 await step('bind',await new Contract(adapter,artifact('ButterflyVRF').abi,p).bindCollection.populateTransaction(collection));
 await step('consumer',await coordinator.addConsumer.populateTransaction(subId,adapter));
 // Read back the final deployment and economics before producing the disabled handoff.
 const nft=new Contract(collection,artifact('ButterflyNFT').abi,p),exchange=new Contract(market,artifact('ButterflyMarket').abi,p),vrf=new Contract(adapter,artifact('ButterflyVRF').abi,p);
 const [nftCode,marketCode,mintPrice,supply,treasury,fee,marketCollection,randomness,boundCollection,uri,registered,referralBps,maxBatch,callbackGas]=await Promise.all([
  p.getCode(collection),p.getCode(market),nft.MINT_PRICE(),nft.MAX_SUPPLY(),nft.TREASURY(),exchange.FEE_BPS(),exchange.collection(),nft.randomness(),vrf.collection(),nft.contractURI(),coordinator.getSubscription(subId),nft.REFERRAL_BPS(),nft.MAX_BATCH(),vrf.callbackGasLimit()
 ]);
 if(referralBps!==2000n||maxBatch!==20n||callbackGas!==2000000n||mintPrice!==parseEther('0.01')||supply!==7777n||treasury.toLowerCase()!=='0x764dbcd80ca3e5d50cbae986e2b6f507dc47cfcf'||fee!==0n||getAddress(marketCollection)!==getAddress(collection)||getAddress(randomness)!==getAddress(adapter)||getAddress(boundCollection)!==getAddress(collection)||uri!==`${base}collection.json`||!registered.consumers.some(a=>getAddress(a)===getAddress(adapter))||registered.nativeBalance===0n)fail('Final deployment economics/binding/subscription verification failed');
 const frontend=frontendConfig({collection,market,collectionCode:nftCode,marketCode:marketCode,assetBase});
 // This script intentionally cannot enable payments. Independent release verification is required.
 if(process.env.NFT_FRONTEND_CONFIG_OUTPUT){const out=path.resolve(process.env.NFT_FRONTEND_CONFIG_OUTPUT);if(out===filename)fail('Frontend output cannot overwrite receipt journal');fs.writeFileSync(out,JSON.stringify(frontend,null,2)+'\n',{flag:'wx'});}
 console.log(JSON.stringify({adapter,collection,market,totalDeploymentGasBNB:formatEther(spent),frontendConfig:frontend,note:'Subscription funding is separate; frontend remains disabled pending independent verification.'},null,2));
}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});

