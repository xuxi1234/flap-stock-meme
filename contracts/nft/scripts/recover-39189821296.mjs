import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {Contract,getAddress,parseEther,formatEther} from 'ethers';
import {BscProvider} from './bsc-provider.mjs';
import {confirmedReceipt} from './deploy.mjs';
import {verifyPublicAssets,HOSTING_PROPOSAL,SUBSCRIPTION_ABI} from './launch.mjs';
const fail=m=>{throw Error(m);};
const payer='0x74a7D3198905C3b4BA53574C2DffEF3aa4e569aA';
const subId='7752766845231422688186724392588981744567870866350784400960866134053864325923';
const hashes={create:'0x9970ad04a93941d97d627be8021640fbfc3a08d79cab037ea2d96f6ece43df04',fund:'0x19bdecc71561cd1ff784afcbf427fb067aa806d41ba44d11540a24be6fb32a49'};
const adapterHash='0x4591354e54018e64f015d5d8231542cd18c06101f5650c9f60b1a2bcf14a2e63';
const dir=path.resolve(process.env.NFT_RECOVERY_DIR);
const launch=JSON.parse(fs.readFileSync(path.join(dir,'launch-56.json')));
const deployment=JSON.parse(fs.readFileSync(path.join(dir,'deployment-56.json')));
const op=JSON.parse(fs.readFileSync(path.join(dir,'operator.json')));
if(op.runId!=='39189821296'||op.source!=='d232c367b5529e4dc3ad44b3ad176facc5476d8a'||launch.identity.payer!==payer||launch.identity.capWei!==parseEther('0.02').toString()||launch.subscriptionId!==subId||deployment.identity.subId!==subId||deployment.steps.adapter.hash!==adapterHash)fail('Unexpected recovery artifact');
const p=new BscProvider(process.env.NFT_RPC_URL);
try{
 if((await p.getNetwork()).chainId!==56n)fail('Wrong chain');
 let bootstrap=0n;
 for(const [name,hash] of Object.entries(hashes)){
  const old=launch.steps[name];if(old.hash!==hash)fail('Bootstrap hash mismatch');
  const r=await confirmedReceipt(p,hash,old.receipt),tx=await p.getTransaction(hash),i=old.intent;
  if(!tx||tx.from!==payer||tx.chainId!==56n||tx.to!==getAddress(launch.identity.coordinator)||tx.data!==i.data||tx.nonce!==i.nonce||tx.value!==BigInt(i.value)||r.gasUsed>BigInt(i.gasLimit)||r.gasPrice>BigInt(i.gasPrice))fail('Bootstrap transaction mismatch');
  bootstrap+=tx.value+r.gasUsed*r.gasPrice;
 }
 const coordinator=new Contract(launch.identity.coordinator,SUBSCRIPTION_ABI,p),sub=await coordinator.getSubscription(subId);
 if(sub.owner!==payer||sub.nativeBalance!==parseEther('0.01')||sub.consumers.length!==0)fail('Unexpected existing subscription state');
 const adapterReceipt=await confirmedReceipt(p,adapterHash);
 if(getAddress(adapterReceipt.contractAddress)!==getAddress('0x0843825446108b5d7f3c7e6f01676e66208e1f31')||await p.getCode(adapterReceipt.contractAddress)==='0x')fail('Missing original adapter');
 await verifyPublicAssets({base:HOSTING_PROPOSAL.metadataBase,assetBase:HOSTING_PROPOSAL.assetBase});
 const allowance=parseEther('0.02')-bootstrap;
 console.log(JSON.stringify({bootstrapBNB:formatEther(bootstrap),deploymentAllowanceBNB:formatEther(allowance),adapter:adapterReceipt.contractAddress,subscriptionId:subId}));
 const execute=process.argv.includes('--execute');
 const env={...process.env,NFT_SIGNER_ADDRESS:payer,NFT_METADATA_BASE:HOSTING_PROPOSAL.metadataBase,NFT_ASSET_BASE:HOSTING_PROPOSAL.assetBase,NFT_VRF_SUBSCRIPTION_ID:subId,NFT_MAX_SPEND_BNB:formatEther(allowance),NFT_DEPLOY_JOURNAL:path.join(dir,'deployment-56.json'),NFT_FRONTEND_CONFIG_OUTPUT:path.join(dir,'frontend-disabled.json'),NFT_DEPLOY_CONFIRM:`DEPLOY_BUTTERFLY_ON_56:${payer}`};
 if(!execute)delete env.NFT_DEPLOY_PRIVATE_KEY;
 const result=spawnSync(process.execPath,['scripts/deploy.mjs',...(execute?['--execute']:[])],{env,stdio:'inherit'});
 if(result.status!==0)fail('Recovery stopped; preserve this run artifact before any further recovery');
}finally{p.destroy();}
