// One-time deployment. Read-only unless --execute AND exact budget approval are provided.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {Contract,ContractFactory,Wallet,keccak256,parseEther,formatEther} from 'ethers';
import {compile} from '../test/compile.mjs';import {BscProvider} from './bsc-provider.mjs';import {verifyPublicAssets,HOSTING_PROPOSAL} from './launch.mjs';
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'));
const PAYER='0x74a7D3198905C3b4BA53574C2DffEF3aa4e569aA',INVITER='0x0000000000000000000000000000000000000000',WRAPPER='0x471506e6ADED0b9811D05B8cAc8Db25eE839Ac94';
const RECIPIENT='0x1aee21A82300f315Bb3782dFb0330477C5b87C58',IDS=[1,520,1314,7777];
const PRIOR=0n,CAP=parseEther('0.002'),FUND=parseEther('0.001'),PRICE=parseEther('0.01'),MAX_GP=100000000n;
const execute=process.argv.includes('--execute'),p=new BscProvider(process.env.NFT_RPC_URL||'https://bsc-dataseed.binance.org');
const check=(ok,m)=>{if(!ok)throw Error(m);};
const dir=path.resolve(process.env.RESERVED_OUTPUT_DIR||'reserved-output');fs.mkdirSync(dir,{recursive:true});const file=dir+'/journal.json';
const journal={payer:PAYER,inviter:INVITER,priorWei:String(PRIOR),capWei:String(CAP),recipient:RECIPIENT,tokenIds:IDS,steps:{}};
const save=()=>{fs.writeFileSync(file+'.tmp',JSON.stringify(journal,null,2));fs.renameSync(file+'.tmp',file);};
try{
check((await p.getNetwork()).chainId===56n,'Wrong chain');
const art=compile(),artifact=n=>art[`src/${n}.sol`][n];
check(await p.getCode(RECIPIENT)==='0x','Recipient is now a contract: review receiver support');
check(await p.getCode(WRAPPER)!=='0x','Wrapper missing');
const w=new Contract(WRAPPER,['function calculateRequestPriceNative(uint32,uint32) view returns(uint256)','function s_disabled() view returns(bool)','function s_configured() view returns(bool)'],p);
const gp=(await p.getFeeData()).gasPrice;check(gp>0n&&gp<=MAX_GP,'Gas exceeds ceiling');
const quote=await w.calculateRequestPriceNative(100000,1,{gasPrice:gp});check(!await w.s_disabled()&&await w.s_configured()&&quote>0n&&quote<=parseEther('0.0001'),'Direct oracle unavailable/fee above cap');
await verifyPublicAssets({base:HOSTING_PROPOSAL.metadataBase,assetBase:HOSTING_PROPOSAL.assetBase});
const gasBound=10000000n;check(PRIOR+FUND+gasBound*MAX_GP<=CAP,'Total budget bound failed');
check(await p.getBalance(PAYER)>=FUND+gasBound*MAX_GP,'Insufficient payer balance');
console.log(JSON.stringify({mode:execute?'execute':'check-only',priorBNB:formatEther(PRIOR),fundBNB:formatEther(FUND),testMintBNB:'0',recipient:RECIPIENT,tokenIds:IDS,currentOracleQuoteBNB:formatEther(quote),cumulativeWorstCaseBNB:formatEther(PRIOR+FUND+gasBound*MAX_GP),capBNB:formatEther(CAP)}));
if(execute){
check(process.env.RESERVED_APPROVAL==='APPROVE_RESERVED_MAX_0.002_BNB','Exact revised budget approval required');
check(process.env.GITHUB_RUN_ATTEMPT==='1','Do not rerun: reconcile preserved journal');
check(!fs.existsSync(file),'Existing journal: reconcile before execution');
const signer=new Wallet(process.env.NFT_DEPLOY_PRIVATE_KEY,p);check(signer.address===PAYER,'Wrong signer');
const marker=await fetch('https://api.github.com/repos/'+process.env.GITHUB_REPOSITORY+'/git/refs',{method:'POST',headers:{Authorization:'Bearer '+process.env.GH_TOKEN,Accept:'application/vnd.github+json','Content-Type':'application/json'},body:JSON.stringify({ref:'refs/heads/automation/butterfly-reserved-launch-20261021',sha:process.env.GITHUB_SHA})});check(marker.status===201,'Already reserved: reconcile artifacts; never delete marker');save();
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
const collection=await deploy('collection','ButterflyReservedNFT',[adapter,HOSTING_PROPOSAL.metadataBase],4500000n);journal.collection=collection;save();
const market=await deploy('market','ButterflyMarket',[collection],1500000n);journal.market=market;save();
const a=new Contract(adapter,artifact('ButterflyDirectVRF').abi,p),n=new Contract(collection,artifact('ButterflyReservedNFT').abi,p),m=new Contract(market,artifact('ButterflyMarket').abi,p);
await send('bind',await a.bindCollection.populateTransaction(collection),100000n);
check(await a.collection()===collection&&await n.randomness()===adapter&&await m.collection()===collection&&await m.FEE_BPS()===0n&&await n.MINT_PRICE()===PRICE&&await n.REFERRAL_BPS()===2000n&&await n.MAX_BATCH()===20n&&await n.MAX_SUPPLY()===7777n&&await n.TREASURY()==='0x764dBCD80ca3E5d50CBAe986e2b6F507Dc47CfcF','Final configuration mismatch');
await send('fund',await a.fundOracle.populateTransaction({value:FUND}),100000n);
check(await n.ALLOCATION_RECIPIENT()===RECIPIENT&&await n.PREALLOCATED_SUPPLY()===4n&&await n.PUBLIC_SUPPLY()===7773n,'Allocation constants mismatch');
check(await n.reserved()===4n&&await n.assigned()===4n&&await n.minted()===4n&&await n.totalSupply()===4n,'Initial supply mismatch');
for(const id of IDS){
 check(await n.ownerOf(id)===RECIPIENT,'Wrong allocation owner: '+id);
 check(await n.tokenURI(id)===HOSTING_PROPOSAL.metadataBase+id+'.json','Wrong metadata: '+id);
}
const config={enabled:false,preallocatedSupply:4,allocationRecipient:RECIPIENT,optionalReferrer:true,randomnessMode:'direct',chainId:56,adapter,adapterCodeHash:keccak256(await p.getCode(adapter)),collection,collectionCodeHash:keccak256(await p.getCode(collection)),market,marketCodeHash:keccak256(await p.getCode(market)),assetBase:HOSTING_PROPOSAL.assetBase,reason:'四张指定编号已在部署时铸造，待独立核验与前端发布。'};
fs.writeFileSync(dir+'/frontend-disabled.json',JSON.stringify(config,null,2));journal.completed=true;save();console.log(JSON.stringify({completed:true,tokenIds:IDS,recipient:RECIPIENT,totalBNB:formatEther(spent),config}));
}
}finally{await p.destroy();}
