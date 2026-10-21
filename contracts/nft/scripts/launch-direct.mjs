// One-time deployment. Read-only unless --execute AND exact budget approval are provided.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {Contract,ContractFactory,Wallet,getAddress,keccak256,parseEther,formatEther} from 'ethers';
import {compile} from '../test/compile.mjs';import {BscProvider} from './bsc-provider.mjs';import {verifyPublicAssets,HOSTING_PROPOSAL} from './launch.mjs';
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'));
const PAYER='0x74a7D3198905C3b4BA53574C2DffEF3aa4e569aA',INVITER='0xCe1e5D01DF016630F732c798d983FA0db86b38A8',WRAPPER='0x471506e6ADED0b9811D05B8cAc8Db25eE839Ac94';
const OLD='0x4c751e8b555F1C72cf572789CcFF05e0e118Fc8f',OLD_ID='103802155601717079762219619182970600567020980371426818064906224458216881034266',OLD_TX='0x34ac5727cb5e74f85f64493322c01274a6fb14542c255294be75a9fbaff94bbb';
const PRIOR=parseEther('0.0202349867'),CAP=parseEther('0.033'),FUND=parseEther('0.001'),PRICE=parseEther('0.01'),MAX_GP=100000000n;
const execute=process.argv.includes('--execute'),p=new BscProvider(process.env.NFT_RPC_URL||'https://bsc-dataseed.binance.org');
const check=(ok,m)=>{if(!ok)throw Error(m);};
const dir=path.resolve(process.env.DIRECT_OUTPUT_DIR||'direct-output');fs.mkdirSync(dir,{recursive:true});const file=dir+'/journal.json';
const journal={payer:PAYER,inviter:INVITER,priorWei:String(PRIOR),capWei:String(CAP),old:{collection:OLD,requestId:OLD_ID,hash:OLD_TX},steps:{}};
const save=()=>{fs.writeFileSync(file+'.tmp',JSON.stringify(journal,null,2));fs.renameSync(file+'.tmp',file);};
try{
check((await p.getNetwork()).chainId===56n,'Wrong chain');
const oldReceipt=await p.getTransactionReceipt(OLD_TX);check(oldReceipt?.status===1&&oldReceipt.blockHash==='0xe140148c4795336233ee5bce56ac235cedfb6f29b4fbadb05111d9ed76e6207c','Old receipt mismatch');
const art=compile(),artifact=n=>art[`src/${n}.sol`][n];
const old=new Contract(OLD,artifact('ButterflyNFT').abi,p);const oldState=await old.requests(OLD_ID);journal.old.tokenId=String(oldState.tokenId);journal.old.claimed=oldState.claimed;
check(await p.getCode(WRAPPER)!=='0x','Wrapper missing');
const w=new Contract(WRAPPER,['function calculateRequestPriceNative(uint32,uint32) view returns(uint256)','function s_disabled() view returns(bool)','function s_configured() view returns(bool)'],p);
const gp=(await p.getFeeData()).gasPrice;check(gp>0n&&gp<=MAX_GP,'Gas exceeds ceiling');
const quote=await w.calculateRequestPriceNative(100000,1,{gasPrice:gp});check(!await w.s_disabled()&&await w.s_configured()&&quote>0n&&quote<=parseEther('0.0001'),'Direct oracle unavailable/fee above cap');
await verifyPublicAssets({base:HOSTING_PROPOSAL.metadataBase,assetBase:HOSTING_PROPOSAL.assetBase});
const gasBound=10000000n;check(PRIOR+FUND+PRICE+gasBound*MAX_GP<=CAP,'Total budget bound failed');
check(await p.getBalance(PAYER)>=FUND+PRICE+gasBound*MAX_GP,'Insufficient payer balance');
console.log(JSON.stringify({mode:execute?'execute':'check-only',priorBNB:formatEther(PRIOR),fundBNB:formatEther(FUND),testMintBNB:formatEther(PRICE),currentOracleQuoteBNB:formatEther(quote),cumulativeWorstCaseBNB:formatEther(PRIOR+FUND+PRICE+gasBound*MAX_GP),capBNB:formatEther(CAP),old:journal.old}));
if(execute){
check(process.env.DIRECT_APPROVAL==='APPROVE_TOTAL_0.033_BNB','Exact revised budget approval required');
check(process.env.GITHUB_RUN_ATTEMPT==='1','Do not rerun: reconcile preserved journal');
check(!fs.existsSync(file),'Existing journal: reconcile before execution');
const signer=new Wallet(process.env.NFT_DEPLOY_PRIVATE_KEY,p);check(signer.address===PAYER,'Wrong signer');
const marker=await fetch('https://api.github.com/repos/'+process.env.GITHUB_REPOSITORY+'/git/refs',{method:'POST',headers:{Authorization:'Bearer '+process.env.GH_TOKEN,Accept:'application/vnd.github+json','Content-Type':'application/json'},body:JSON.stringify({ref:'refs/heads/automation/butterfly-direct-launch-20261020',sha:process.env.GITHUB_SHA})});check(marker.status===201,'Already reserved: reconcile artifacts; never delete marker');save();
let spent=PRIOR,gasUsedBound=0n;
async function send(label,request,hardGas){
 const gasPrice=(await p.getFeeData()).gasPrice;check(gasPrice>0n&&gasPrice<=MAX_GP,'Gas price cap');
 const estimate=await p.estimateGas({...request,from:PAYER,gasPrice}),gasLimit=estimate*120n/100n+10000n;check(gasLimit<=hardGas,'Step gas cap: '+label);check(gasUsedBound+gasLimit<=gasBound,'Total gas cap');
 const value=request.value||0n;check(spent+value+gasLimit*gasPrice<=CAP,'Cumulative spend cap');
 const nonce=await p.getTransactionCount(PAYER,'latest');check(await p.getTransactionCount(PAYER,'pending')===nonce,'Wallet has pending transactions');
 journal.steps[label]={intent:{nonce,to:request.to||null,dataHash:keccak256(request.data),value:String(value),gasLimit:String(gasLimit),gasPrice:String(gasPrice)}};save();
 const tx=await signer.sendTransaction({...request,nonce,chainId:56,type:0,gasPrice,gasLimit});journal.steps[label].hash=tx.hash;save();console.log(label+' '+tx.hash);const r=await tx.wait(3);check(r?.status===1,'Failed receipt: '+label);journal.steps[label].receipt=r.toJSON();spent+=value+r.gasUsed*r.gasPrice;gasUsedBound+=r.gasUsed;journal.spentWei=String(spent);save();return r;
}
async function deploy(label,name,args,gas){const a=artifact(name),tx=await new ContractFactory(a.abi,a.evm.bytecode.object).getDeployTransaction(...args);const r=await send(label,tx,gas);check(r.contractAddress,'Missing deployment address');const actual=await p.getTransaction(r.hash);check(actual?.from===PAYER&&actual.to===null&&actual.data===tx.data,'Creation bytecode mismatch');return r.contractAddress;}
const adapter=await deploy('adapter','ButterflyDirectVRF',[WRAPPER],2000000n);journal.adapter=adapter;save();
const collection=await deploy('collection','ButterflyNFT',[adapter,HOSTING_PROPOSAL.metadataBase],3500000n);journal.collection=collection;save();
const market=await deploy('market','ButterflyMarket',[collection],1500000n);journal.market=market;save();
const a=new Contract(adapter,artifact('ButterflyDirectVRF').abi,p),n=new Contract(collection,artifact('ButterflyNFT').abi,p),m=new Contract(market,artifact('ButterflyMarket').abi,p);
await send('bind',await a.bindCollection.populateTransaction(collection),100000n);
check(await a.collection()===collection&&await n.randomness()===adapter&&await m.collection()===collection&&await m.FEE_BPS()===0n&&await n.MINT_PRICE()===PRICE&&await n.REFERRAL_BPS()===2000n&&await n.MAX_BATCH()===20n&&await n.MAX_SUPPLY()===7777n&&await n.TREASURY()==='0x764dBCD80ca3E5d50CBAe986e2b6F507Dc47CfcF','Final configuration mismatch');
await send('fund',await a.fundOracle.populateTransaction({value:FUND}),100000n);
await send('mint',await n['requestMint(uint256,address)'].populateTransaction(1,INVITER,{value:PRICE}),700000n);
const ids=await n.payerRequests(PAYER,0,10);check(ids.length===1,'Unexpected request count');const id=ids[0];journal.requestId=String(id);save();
let ready=false;for(let i=0;i<60;i++){if(await a.ready(id)){ready=true;break;}await new Promise(r=>setTimeout(r,10000));}check(ready,'Oracle pending: preserve artifact; do not mint again');
await send('finalize',await a.finalize.populateTransaction(),500000n);
await send('claim',await n.claim.populateTransaction(id,PAYER),500000n);
const tokens=await n.requestTokenIds(id);check(tokens.length===1&&await n.ownerOf(tokens[0])===PAYER&&(await n.requests(id)).claimed&&await n.referralRewards(INVITER)===parseEther('0.002'),'Claim/referral verification failed');
journal.tokenId=String(tokens[0]);journal.tokenURI=await n.tokenURI(tokens[0]);check(journal.tokenURI===HOSTING_PROPOSAL.metadataBase+tokens[0]+'.json','Wrong metadata');
const metadata=await fetch(journal.tokenURI);check(metadata.ok,'Metadata unavailable');const md=await metadata.json();check(md.image===HOSTING_PROPOSAL.assetBase+'art/'+tokens[0]+'.jpg','Wrong image');check((await fetch(md.image)).ok,'Image unavailable');
const config={enabled:false,randomnessMode:'direct',chainId:56,adapter,adapterCodeHash:keccak256(await p.getCode(adapter)),collection,collectionCodeHash:keccak256(await p.getCode(collection)),market,marketCodeHash:keccak256(await p.getCode(market)),assetBase:HOSTING_PROPOSAL.assetBase,reason:'新版真实铸造已验收，待独立核验与前端发布。'};
fs.writeFileSync(dir+'/frontend-disabled.json',JSON.stringify(config,null,2));journal.completed=true;save();console.log(JSON.stringify({completed:true,tokenId:String(tokens[0]),totalBNB:formatEther(spent),config}));
}
}finally{await p.destroy();}
