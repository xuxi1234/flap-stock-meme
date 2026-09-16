// Proposed launch only. No dotenv or key lookup; check-only is the default.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import solc from 'solc';
import {Contract,JsonRpcProvider,Wallet,getAddress,parseEther,formatEther} from 'ethers';
import {compile} from '../test/compile.mjs';
import {confirmedReceipt,validateMetadata} from './deploy.mjs';
export const HOSTING_PROPOSAL=JSON.parse(fs.readFileSync(new URL('../config/launch-proposal.json',import.meta.url),'utf8'));
export const ALLOWED_SIGNER=getAddress('0x74a7d3198905c3b4ba53574c2dffef3aa4e569aa');
export const TOTAL_CAP=parseEther('0.02');
export const INITIAL_FUND=parseEther('0.01');
export const CONFIRMATION=`APPROVE_BUTTERFLY_56:${ALLOWED_SIGNER}:MAX_0.02_BNB:VRF_0.01_BNB`;
export const DEPLOY_GAS_BOUND=8350000n;
export const BOOTSTRAP_LIMITS={create:500000n,fund:200000n};
// Official ABI: https://github.com/smartcontractkit/chainlink/blob/contracts-v1.3.0/contracts/src/v0.8/vrf/dev/SubscriptionAPI.sol
export const SUBSCRIPTION_ABI=[
 'function createSubscription() returns(uint256 subId)',
 'function fundSubscriptionWithNative(uint256 subId) payable',
 'event SubscriptionCreated(uint256 indexed subId,address owner)',
 'function getSubscription(uint256) view returns(uint96 balance,uint96 nativeBalance,uint64 reqCount,address owner,address[] consumers)',
 'function getRequestConfig() view returns(uint16 minimumRequestConfirmations,uint32 maxGasLimit,bytes32[] provingKeyHashes)'
];
const fail=m=>{throw new Error(m);};
export function validateLaunchInputs(env,execute=false){
 const signer=getAddress(env.NFT_SIGNER_ADDRESS);
 if(signer!==ALLOWED_SIGNER)fail('Launch payer is not the explicitly proposed address');
 const cap=parseEther(env.NFT_LAUNCH_MAX_SPEND_BNB),fund=parseEther(env.NFT_VRF_INITIAL_FUND_BNB);
 if(cap!==TOTAL_CAP||fund!==INITIAL_FUND)fail('This reviewed proposal requires exactly 0.02 BNB cap and 0.01 BNB VRF funding');
 const base=validateMetadata(env.NFT_METADATA_BASE),assetBase=validateMetadata(env.NFT_ASSET_BASE);
 if(!assetBase.startsWith('https://'))fail('NFT_ASSET_BASE must use HTTPS');
 if(base!==HOSTING_PROPOSAL.metadataBase||assetBase!==HOSTING_PROPOSAL.assetBase)fail('Hosting URLs differ from reviewed launch proposal');
 if(execute&&env.NFT_LAUNCH_CONFIRM!==CONFIRMATION)fail('Explicit launch payer/funding/cumulative-cap confirmation required');
 return {signer,cap,fund,base,assetBase};
}
async function publicBytes(url,mime,maxBytes,fetcher){
 const response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(12000),headers:{Accept:mime}});
 if(!response.ok||response.redirected||(response.url&&response.url!==url)||!response.headers.get('content-type')?.toLowerCase().startsWith(mime))fail(`Public asset unavailable or unexpected response: ${url}`);
 if(Number(response.headers.get('content-length')||0)>maxBytes)fail('Public asset exceeds size limit');
 const reader=response.body?.getReader();if(!reader)fail('Public asset body missing');
 const chunks=[];let size=0;
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes){await reader.cancel();fail('Public asset exceeds size limit');}chunks.push(Buffer.from(value));}
 return Buffer.concat(chunks);
}
export async function verifyPublicAssets({base,assetBase,fetcher=fetch,proposal=HOSTING_PROPOSAL}){
 if(base!==proposal.metadataBase||assetBase!==proposal.assetBase)fail('Public hosting differs from pinned proposal');
 const json=async url=>JSON.parse((await publicBytes(url,'application/json',1048576,fetcher)).toString('utf8'));
 const manifest=await json(`${assetBase}manifest.json`);
 if(manifest.collectionHash!==proposal.collectionHash||manifest.imageCollectionHash!==proposal.imageCollectionHash||manifest.supply!==7777||manifest.uniqueArtworkHashes!==7777||manifest.artFormat!=='JPEG'||manifest.metadataBase!==base)fail('Public manifest does not match reviewed artwork/image hashes');
 const samples=await Promise.all(Object.entries(proposal.samples).map(async([id,expected])=>{
  const tokenURI=`${base}${id}.json`,metadata=await json(tokenURI),image=`${assetBase}art/${id}.jpg`;
  if(metadata.properties?.edition!==Number(id)||metadata.name!==expected.name||metadata.properties?.artwork_sha256!==expected.artworkHash||metadata.properties?.image_sha256!==expected.imageHash||metadata.image!==image)fail(`Public metadata identity or absolute image URL mismatch: ${id}`);
  const bytes=await publicBytes(image,'image/jpeg',2097152,fetcher);
  if(bytes[0]!==255||bytes[1]!==216||bytes[bytes.length-2]!==255||bytes[bytes.length-1]!==217||createHash('sha256').update(bytes).digest('hex')!==expected.imageHash)fail(`Public JPEG differs from reviewed image: ${id}`);
  return {id:Number(id),tokenURI,image,imageHash:expected.imageHash};
 }));
 const collection=await json(`${base}collection.json`);
 if(typeof collection.name!=='string'||!collection.name.trim()||collection.seller_fee_basis_points!==0||collection.image!==`${assetBase}art/7777.jpg`)fail('Public collection metadata is invalid');
 return {collectionHash:manifest.collectionHash,imageCollectionHash:manifest.imageCollectionHash,samples};
}
export function bootstrapSpent(journal){
 return Object.values(journal.steps).reduce((sum,s)=>sum+BigInt(s.actualCostWei||0),0n);
}
export function deploymentAllowance(cap,bootstrapCost){
 if(bootstrapCost<0n||bootstrapCost>=cap)fail('Bootstrap exhausted cumulative launch cap');
 return cap-bootstrapCost;
}
const intentFor=(request,signer)=>({from:signer,to:getAddress(request.to),data:request.data,value:BigInt(request.value||0).toString(),chainId:56});
export function assertSameIntent(record,request,signer){
 const expected=intentFor(request,signer);
 for(const [key,value] of Object.entries(expected))if(record[key]!==value)fail(`Immutable bootstrap intent mismatch: ${key}`);
}
// A saved intent without a hash always stops: the operator must reconcile the nonce,
// not retry createSubscription/funding and risk a duplicate external action.
export async function bootstrapStep({provider,signer,signerAddress,journal,label,request,gasLimitBound,gasPrice,cap,save}){
 const old=journal.steps[label];
 if(old){
  assertSameIntent(old.intent,request,signerAddress);
  if(!old.hash)fail(`Unresolved ${label} broadcast intent; reconcile nonce before resuming`);
  const receipt=await confirmedReceipt(provider,old.hash,old.receipt);
  const tx=await provider.getTransaction(old.hash);
  if(!tx||getAddress(tx.from)!==signerAddress||getAddress(tx.to)!==old.intent.to||tx.data!==old.intent.data||tx.value.toString()!==old.intent.value||tx.nonce!==old.intent.nonce||tx.chainId!==56n)fail('Recovered bootstrap transaction does not match immutable intent');
  if(receipt.gasUsed>BigInt(old.intent.gasLimit)||receipt.gasPrice>BigInt(old.intent.gasPrice))fail('Recovered bootstrap gas exceeds intent bounds');
  old.receipt=receipt.toJSON();old.actualCostWei=(BigInt(old.intent.value)+receipt.gasUsed*receipt.gasPrice).toString();save();
  if(bootstrapSpent(journal)>cap)fail('Recovered bootstrap exceeded cumulative cap');
  return receipt;
 }
 const estimate=await provider.estimateGas({...request,from:signerAddress});
 const gasLimit=(estimate*120n+99n)/100n;
 if(gasLimit>gasLimitBound)fail(`${label} gas estimate exceeds reviewed bound`);
 const maxCost=BigInt(request.value||0)+gasLimit*gasPrice;
 if(bootstrapSpent(journal)+maxCost>cap)fail('Bootstrap transaction would exceed cumulative launch cap');
 const latest=await provider.getTransactionCount(signerAddress,'latest'),nonce=await provider.getTransactionCount(signerAddress,'pending');
 if(nonce!==latest)fail('Signer has pending transactions; use no concurrent transactions during launch');
 journal.steps[label]={intent:{...intentFor(request,signerAddress),nonce,gasLimit:gasLimit.toString(),gasPrice:gasPrice.toString()}};save();
 const tx=await signer.sendTransaction({...request,nonce,gasLimit,gasPrice,type:0,chainId:56});journal.steps[label].hash=tx.hash;save();
 await tx.wait(3);
 // Use the same verification/reconciliation path for new and resumed transactions.
 return bootstrapStep({provider,signer,signerAddress,journal,label,request,gasLimitBound,gasPrice,cap,save});
}
export function subscriptionIdFromReceipt(receipt,coordinator,iface,owner){
 const matches=[];
 for(const log of receipt.logs){
  if(getAddress(log.address)!==getAddress(coordinator))continue;
  let event;try{event=iface.parseLog(log);}catch{continue;}
  if(event?.name==='SubscriptionCreated'&&getAddress(event.args.owner)===owner)matches.push(event.args.subId);
 }
 if(matches.length!==1||matches[0]<=0n)fail('Creation receipt must identify exactly one subscription owned by launch signer');
 return matches[0];
}
async function main(){
 const execute=process.argv.includes('--execute');
 const required=['NFT_RPC_URL','NFT_SIGNER_ADDRESS','NFT_METADATA_BASE','NFT_ASSET_BASE','NFT_LAUNCH_MAX_SPEND_BNB','NFT_VRF_INITIAL_FUND_BNB'];
 const missing=required.filter(k=>!process.env[k]);
 const proposal={chainId:56,payer:ALLOWED_SIGNER,totalCapBNB:'0.02',initialVRFFundingBNB:'0.01',confirmation:CONFIRMATION,transactions:['createSubscription','fundSubscriptionWithNative','deploy adapter','deploy collection','deploy market','bind collection','register adapter consumer'],status:'PROPOSED — user approval of payer and budget still required'};
 if(missing.length){console.log(JSON.stringify({mode:'check-only',ready:false,proposal,missing},null,2));if(execute)fail('Missing launch inputs');return;}
 const inputs=validateLaunchInputs(process.env,execute);
 const cfg=JSON.parse(fs.readFileSync('config/bsc-vrf.json','utf8'));
 const provider=new JsonRpcProvider(process.env.NFT_RPC_URL);
 if((await provider.getNetwork()).chainId!==56n)fail('Only chain 56 supported');
 if(await provider.getCode(cfg.coordinator)==='0x')fail('Missing pinned coordinator code');
 const coordinator=new Contract(cfg.coordinator,SUBSCRIPTION_ABI,provider),oracle=await coordinator.getRequestConfig();
 if(!oracle.provingKeyHashes.includes(cfg.keyHash)||cfg.confirmations<Number(oracle.minimumRequestConfirmations)||cfg.callbackGasLimit>Number(oracle.maxGasLimit))fail('Pinned VRF configuration unsupported');
 // Fail compilation before creating or funding anything.
 compile();
 const files=['scripts/launch.mjs','scripts/deploy.mjs','test/compile.mjs','config/bsc-vrf.json','config/launch-proposal.json','package-lock.json',...fs.readdirSync('src').sort().map(n=>`src/${n}`)];
 const implementationHash=createHash('sha256').update(JSON.stringify({compiler:solc.version(),files:Object.fromEntries(files.map(f=>[f,fs.readFileSync(f,'utf8')]))})).digest('hex');
 const launchFile=path.resolve(process.env.NFT_LAUNCH_JOURNAL||'launch-56.json'),deployFile=path.resolve(process.env.NFT_DEPLOY_JOURNAL||'deployment-56.json');
 const output=process.env.NFT_FRONTEND_CONFIG_OUTPUT?path.resolve(process.env.NFT_FRONTEND_CONFIG_OUTPUT):null;
 if(launchFile===deployFile||output===launchFile||output===deployFile)fail('Launch, deployment and frontend output paths must differ');
 const identity={chainId:56,payer:inputs.signer,capWei:inputs.cap.toString(),initialFundWei:inputs.fund.toString(),metadataBase:inputs.base,assetBase:inputs.assetBase,coordinator:cfg.coordinator,implementationHash,deployFile};
 const journalSnapshot=fs.existsSync(launchFile)?fs.readFileSync(launchFile,'utf8'):null;
 const journal=journalSnapshot?JSON.parse(journalSnapshot):{identity,steps:{}};
 if(JSON.stringify(journal.identity)!==JSON.stringify(identity))fail('Launch journal identity does not match immutable proposal/code');
 if(!fs.existsSync(launchFile)&&fs.existsSync(deployFile))fail('Existing deployment journal without launch journal; reconcile before creating a subscription');
 const gasPrice=(await provider.getFeeData()).gasPrice;if(!gasPrice||gasPrice<=0n)fail('Missing gas price');
 const gasBound=(BOOTSTRAP_LIMITS.create+BOOTSTRAP_LIMITS.fund+DEPLOY_GAS_BOUND)*gasPrice;
 // This intentionally over-reserves gas on resume; stopping early is safer than undercounting pending sends.
 const forecast=inputs.fund+gasBound;
 if(forecast>inputs.cap)fail(`Conservative launch bound ${formatEther(forecast)} BNB exceeds cumulative cap`);
 if(!Object.keys(journal.steps).length&&await provider.getBalance(inputs.signer)<forecast)fail('Signer cannot cover conservative launch bound');
 const createRequest=await coordinator.createSubscription.populateTransaction();
 const createEstimate=await provider.estimateGas({...createRequest,from:inputs.signer});
 if((createEstimate*120n+99n)/100n>BOOTSTRAP_LIMITS.create)fail('Creation estimate exceeds reviewed gas bound');
 console.log(JSON.stringify({mode:execute?'execute':'check-only',proposal,implementationHash,gasPriceWei:gasPrice.toString(),creationGasEstimate:createEstimate.toString(),conservativeAllGasBNB:formatEther(gasBound),conservativeAllInBNB:formatEther(forecast),journalExists:fs.existsSync(launchFile),note:'Funding and deployment gas share one cap. Frontend output remains disabled.'},null,2));
 const hosting=await verifyPublicAssets({base:inputs.base,assetBase:inputs.assetBase});
 console.log(JSON.stringify({publicAssetsVerified:hosting},null,2));
 if(!execute)return; // No secret read, lock or journal writes before explicit execution gate.
 if(!process.env.NFT_DEPLOY_PRIVATE_KEY)fail('Dedicated NFT_DEPLOY_PRIVATE_KEY required; no wallet/key discovery');
 const signer=new Wallet(process.env.NFT_DEPLOY_PRIVATE_KEY,provider);if(signer.address!==inputs.signer)fail('NFT-only key does not match approved payer');
 const lockFile=`${launchFile}.lock`;let lock;
 try{lock=fs.openSync(lockFile,'wx',0o600);fs.writeFileSync(lock,JSON.stringify({pid:process.pid,identity}));}catch{fail('Launch lock exists; verify no active launch and reconcile journals before removing stale lock');}
 const save=()=>{fs.writeFileSync(`${launchFile}.tmp`,JSON.stringify(journal,null,2),{mode:0o600});fs.renameSync(`${launchFile}.tmp`,launchFile);};
 try{
  const lockedSnapshot=fs.existsSync(launchFile)?fs.readFileSync(launchFile,'utf8'):null;
  if(lockedSnapshot!==journalSnapshot)fail('Launch journal changed before lock acquisition; rerun from current journal');
  save();
  const created=await bootstrapStep({provider,signer,signerAddress:inputs.signer,journal,label:'create',request:createRequest,gasLimitBound:BOOTSTRAP_LIMITS.create,gasPrice,cap:inputs.cap,save});
  const subId=subscriptionIdFromReceipt(created,cfg.coordinator,coordinator.interface,inputs.signer);
  if(journal.subscriptionId&&journal.subscriptionId!==subId.toString())fail('Journal subscription ID differs from canonical creation event');
  journal.subscriptionId=subId.toString();save();
  const sub=await coordinator.getSubscription(subId);
  if(getAddress(sub.owner)!==inputs.signer)fail('Created subscription owner mismatch');
  if(!journal.steps.fund&&(sub.nativeBalance!==0n||sub.balance!==0n||sub.reqCount!==0n||sub.consumers.length))fail('New subscription is no longer fresh; reconcile before funding');
  await bootstrapStep({provider,signer,signerAddress:inputs.signer,journal,label:'fund',request:{...await coordinator.fundSubscriptionWithNative.populateTransaction(subId),value:inputs.fund},gasLimitBound:BOOTSTRAP_LIMITS.fund,gasPrice,cap:inputs.cap,save});
  const funded=await coordinator.getSubscription(subId);
  if(getAddress(funded.owner)!==inputs.signer||funded.nativeBalance===0n)fail('Funded subscription verification failed');
  const spent=bootstrapSpent(journal),allowance=deploymentAllowance(inputs.cap,spent);
  journal.deploymentAllowanceWei=allowance.toString();save();
  console.log(JSON.stringify({subscriptionId:subId.toString(),actualBootstrapCostBNB:formatEther(spent),forwardedDeploymentCapBNB:formatEther(allowance)},null,2));
  // Whitelist child environment. The child's budget includes all its previous deployment gas
  // on resume, while ours already subtracts native funding and confirmed bootstrap gas.
  const childEnv={PATH:process.env.PATH,NFT_RPC_URL:process.env.NFT_RPC_URL,NFT_SIGNER_ADDRESS:inputs.signer,NFT_METADATA_BASE:inputs.base,NFT_ASSET_BASE:inputs.assetBase,NFT_VRF_SUBSCRIPTION_ID:subId.toString(),NFT_MAX_SPEND_BNB:formatEther(allowance),NFT_DEPLOY_CONFIRM:`DEPLOY_BUTTERFLY_ON_56:${inputs.signer}`,NFT_DEPLOY_PRIVATE_KEY:process.env.NFT_DEPLOY_PRIVATE_KEY,NFT_DEPLOY_JOURNAL:deployFile};
  if(output)childEnv.NFT_FRONTEND_CONFIG_OUTPUT=output;
  const child=spawnSync(process.execPath,['scripts/deploy.mjs','--execute'],{env:childEnv,stdio:'inherit'});
  if(child.error||child.status!==0)fail('Deployment stopped; retain both journals and resume the same launch after reviewing the reported cause');
  const deployed=JSON.parse(fs.readFileSync(deployFile,'utf8'));
  const deploymentGas=Object.values(deployed.steps).reduce((sum,s)=>sum+BigInt(s.costWei||0),0n);
  if(spent+deploymentGas>inputs.cap)fail('Final combined costs exceed approved cap');
  journal.completed={subscriptionId:subId.toString(),bootstrapCostWei:spent.toString(),deploymentGasWei:deploymentGas.toString(),totalCostWei:(spent+deploymentGas).toString()};save();
  console.log(JSON.stringify({complete:true,totalAllInBNB:formatEther(spent+deploymentGas),capBNB:formatEther(inputs.cap),frontendEnabled:false},null,2));
 }finally{fs.closeSync(lock);fs.unlinkSync(lockFile);}
}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
