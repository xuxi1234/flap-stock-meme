import fs from 'node:fs/promises';import crypto from 'node:crypto';import solc from 'solc';
import {Wallet,JsonRpcProvider,Contract,ContractFactory,getCreateAddress,keccak256,parseEther,formatEther} from 'ethers';
import {compile} from './compile.mjs';
const ACCOUNT='0x74a7D3198905C3b4BA53574C2DffEF3aa4e569aA',REVENUE='0x23898F0866E4D5fa5C9B97645239eD635EA93cDC';
const REPO='xuxi1234/flap-stock-meme',BRANCH='automation/zhongqiu-dual-7777',SITE='zhongqiu-dual-7777';
const WRAPPER='0x471506e6ADED0b9811D05B8cAc8Db25eE839Ac94';
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
class Stop extends Error{}
const need=(ok,s)=>{if(!ok)throw new Stop(s);};
async function json(url){const r=await fetch(url,{signal:AbortSignal.timeout(25000)});need(r.ok,'Public resource unavailable');return r.json();}
async function api(method,url,body,missing=false){
 const r=await fetch(`https://api.github.com/repos/${REPO}${url}`,{method,signal:AbortSignal.timeout(30000),headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 if(missing&&r.status===404)return null;need(r.ok,`GitHub checkpoint request failed (${r.status}); stopped before further spending`);return r.json();
}
export function normalized(code,artifact){let s=code.replace(/^0x/,'');for(const list of Object.values(artifact.evm.deployedBytecode.immutableReferences))for(const r of list)s=s.slice(0,r.start*2)+'0'.repeat(r.length*2)+s.slice((r.start+r.length)*2);return s;}
async function main(){
 const execute=process.env.MOON_OPERATION==='deploy';
 if(execute)need(process.env.GITHUB_EVENT_NAME==='workflow_dispatch'&&process.env.GITHUB_REF==='refs/heads/main'&&process.env.GITHUB_REPOSITORY===REPO&&process.env.MOON_CONFIRM==='dual7777:0.001:revenue23898:gas-unlimited','Manual main-branch deployment confirmation is required');
 const provider=new JsonRpcProvider(process.env.FLAP_BSC_RPC_URL||'https://bsc-dataseed.bnbchain.org');need((await provider.getNetwork()).chainId===56n,'Wrong chain');
 const {input,collection,market}=compile();
 const cfg=JSON.parse(await fs.readFile(new URL('../../dist/nft/edition-config.json',import.meta.url)));
 const hosted=await json('https://zhongqiu.sh/nft/edition-config.json');need(JSON.stringify(hosted)===JSON.stringify(cfg),'Website artwork configuration differs from reviewed source');
 const response=await fetch('https://zhongqiu.sh'+cfg.prefix+'/manifest.json');need(response.ok,'Manifest unavailable');const manifest=Buffer.from(await response.arrayBuffer());need(hash(manifest)===cfg.manifestSha256,'Manifest hash mismatch');
 const manifestData=JSON.parse(manifest);
 for(const k of ['change','rabbit']){
  need(manifestData.collections[k].count===7777,'Incomplete collection');
  const catalogResponse=await fetch('https://zhongqiu.sh'+cfg.prefix+`/${k}/catalog.json`);need(catalogResponse.ok,'Catalog unavailable');const bytes=Buffer.from(await catalogResponse.arrayBuffer());need(hash(bytes)===manifestData.collections[k].catalogSha256,'Catalog hash mismatch');const catalog=JSON.parse(bytes);
  need(catalog.length===7777&&new Set(catalog.map(x=>x.sha256)).size===7777&&new Set(catalog.map(x=>x.story)).size===7777,'Duplicate or incomplete artwork');
  for(const id of [1,3889,7777]){const meta=await json('https://zhongqiu.sh'+cfg.prefix+`/${k}/metadata/${id}.json`);need(meta.image==='https://zhongqiu.sh'+cfg.prefix+`/${k}/images/${id}.webp`,'Unexpected image URL');const img=await fetch(meta.image);need(img.ok&&hash(Buffer.from(await img.arrayBuffer()))===catalog[id-1].sha256,'Image hash mismatch');}
 }
 const vrf=new Contract(WRAPPER,['function link() view returns(address)','function estimateRequestPriceNative(uint32,uint32,uint256) view returns(uint256)'],provider);
 need((await vrf.link()).toLowerCase()==='0x404460c6a5ede2d891e8297795264fde62adbb75','Wrong randomness wrapper');
 const gasPrice=(await provider.getFeeData()).gasPrice;need(gasPrice>0n,'Gas price unavailable');const fee=await vrf.estimateRequestPriceNative(100000,1,gasPrice);
 const sample=await new ContractFactory(collection.abi,collection.evm.bytecode.object).getDeployTransaction("Chang'e Fairies",'CHANGE','https://zhongqiu.sh'+cfg.prefix+'/change/metadata/','0x'+cfg.manifestSha256);
 const estimatedGas=await provider.estimateGas({...sample,from:ACCOUNT});
 const plan={chainId:56,deployer:ACCOUNT,revenue:REVENUE,supplyEach:7777,priceBNB:'0.001',gasCap:null,walletBalanceBNB:formatEther(await provider.getBalance(ACCOUNT)),firstCollectionEstimatedGasBNB:formatEther(estimatedGas*gasPrice),randomnessFeeBNB:formatEther(fee),initialReservePerCollectionBNB:formatEther(fee*100n),canaryMintTotalBNB:'0.002',manifestSha256:cfg.manifestSha256};console.log(JSON.stringify(plan,null,2));
 if(!execute){console.log('Read-only checks complete; no private key loaded and no transaction signed.');return;}
 need(fee>0n&&fee<=parseEther('0.01'),'Randomness fee exceeds contract request limit');
 async function idle(){const r=await api('GET','/actions/runs?per_page=100');const active=r.workflow_runs.filter(x=>String(x.id)!==process.env.GITHUB_RUN_ID&&/airdrop|mint/i.test(x.path||'')&&['in_progress','queued','waiting','pending','requested'].includes(x.status));need(active.length===0,'Another wallet workflow is active or queued; let it finish before NFT deployment');}
 await idle();
 const wallet=new Wallet(process.env.FLAP_MINT_PRIVATE_KEY||'',provider);need(wallet.address.toLowerCase()===ACCOUNT.toLowerCase(),'Signing secret does not match authorized wallet');
 const releaseHash=hash(JSON.stringify({input,cfg}));let sha;
 let journal={project:'zhongqiu-dual-7777',releaseHash,transactions:[]};
 const old=await api('GET',`/contents/journal.json?ref=${BRANCH}`,undefined,true);
 if(old){sha=old.sha;journal=JSON.parse(Buffer.from(old.content,'base64').toString());need(journal.project==='zhongqiu-dual-7777'&&journal.releaseHash===releaseHash,'Existing journal belongs to a different release; do not redeploy');}
 async function save(){const content=JSON.stringify(journal,null,2);if(!sha){const t=await api('POST','/git/trees',{tree:[{path:'journal.json',mode:'100644',type:'blob',content},{path:'vercel.json',mode:'100644',type:'blob',content:'{"git":{"deploymentEnabled":false}}'}]});const c=await api('POST','/git/commits',{message:'Initialize NFT deployment checkpoint',tree:t.sha,parents:[]});await api('POST','/git/refs',{ref:'refs/heads/'+BRANCH,sha:c.sha});const current=await api('GET',`/contents/journal.json?ref=${BRANCH}`);need(Buffer.from(current.content,'base64').toString()===content,'Checkpoint confirmation failed');sha=current.sha;}else{const r=await api('PUT','/contents/journal.json',{branch:BRANCH,sha,message:'Checkpoint NFT deployment',content:Buffer.from(content).toString('base64')});sha=r.content.sha;}}
 async function send(label,call){
  await idle();let entry=journal.transactions.find(x=>x.label===label);
  if(entry){need(entry.tx.data===(call.data||'0x')&&(entry.tx.to||'').toLowerCase()===(call.to||'').toLowerCase()&&BigInt(entry.tx.value)===BigInt(call.value||0),'Checkpoint transaction differs from expected action');}
  if(!entry){need(!journal.transactions.some(x=>x.status!=='mined'),'Unresolved earlier transaction');const nonce=await provider.getTransactionCount(ACCOUNT,'latest');need(nonce===await provider.getTransactionCount(ACCOUNT,'pending'),'Wallet has pending transactions');const gasLimit=(await provider.estimateGas({...call,from:ACCOUNT}))*125n/100n;const price=(await provider.getFeeData()).gasPrice;need(price>0n,'Gas price unavailable');const tx={...call,data:call.data||'0x',value:String(call.value||0),chainId:56,nonce,gasLimit:gasLimit.toString(),gasPrice:price.toString(),type:0};need(await provider.getBalance(ACCOUNT)>=BigInt(tx.value)+gasLimit*price,'Insufficient BNB for next transaction');const signed=await wallet.signTransaction(tx);entry={label,tx,hash:keccak256(signed),status:'prepared',...(!call.to?{address:getCreateAddress({from:ACCOUNT,nonce})}:{})};journal.transactions.push(entry);await save();}
  let receipt=await provider.getTransactionReceipt(entry.hash);
  if(!receipt){const known=await provider.getTransaction(entry.hash);if(!known){need(await provider.getTransactionCount(ACCOUNT,'latest')===entry.tx.nonce&&await provider.getTransactionCount(ACCOUNT,'pending')===entry.tx.nonce,'Wallet nonce changed; inspect checkpoint before continuing');const raw=await wallet.signTransaction(entry.tx);need(keccak256(raw)===entry.hash,'Signed transaction hash differs from checkpoint');await provider.broadcastTransaction(raw);}receipt=await provider.waitForTransaction(entry.hash,3,240000);}
  need(receipt&&receipt.status===1&&receipt.from.toLowerCase()===ACCOUNT.toLowerCase(),'Transaction failed or unconfirmed; checkpoint retained');
  if(entry.address)need(receipt.contractAddress?.toLowerCase()===entry.address.toLowerCase(),'Unexpected deployed address');
  entry.status='mined';entry.blockNumber=receipt.blockNumber;await save();console.log(label,entry.hash);return {entry,receipt};
 }
 const deployed={};
 for(const [k,name,symbol] of [['change',"Chang'e Fairies",'CHANGE'],['rabbit','Moon Jade Rabbits','YUTU']]){
  const tx=await new ContractFactory(collection.abi,collection.evm.bytecode.object).getDeployTransaction(name,symbol,'https://zhongqiu.sh'+cfg.prefix+`/${k}/metadata/`,'0x'+cfg.manifestSha256);
  const {entry}=await send('deploy-'+k,tx);const c=new Contract(entry.address,collection.abi,wallet);
  need(normalized(await provider.getCode(entry.address),collection)===normalized(collection.evm.deployedBytecode.object,collection),'Collection runtime mismatch');
  need(await c.name()===name&&await c.symbol()===symbol&&await c.MINT_PRICE()===parseEther('0.001')&&await c.MAX_SUPPLY()===7777n&&await c.REVENUE()===REVENUE&&await c.manifestHash()==='0x'+cfg.manifestSha256,'Collection terms mismatch');
  deployed[k]={address:entry.address,transactionHash:entry.hash,blockNumber:entry.blockNumber};
 }
 const mt=await new ContractFactory(market.abi,market.evm.bytecode.object).getDeployTransaction(deployed.change.address,deployed.rabbit.address);const {entry:me}=await send('deploy-market',mt);
 need(normalized(await provider.getCode(me.address),market)===normalized(market.evm.deployedBytecode.object,market),'Market runtime mismatch');
 const mc=new Contract(me.address,market.abi,provider);need(await mc.change()===deployed.change.address&&await mc.rabbit()===deployed.rabbit.address,'Market collections mismatch');deployed.market={address:me.address,transactionHash:me.hash,blockNumber:me.blockNumber};
 // Persist the first quote so restarts never reinterpret or repeat a reserve transfer.
 if(!journal.initialReserveWei){journal.initialReserveWei=(fee*100n).toString();await save();}
 for(const k of ['change','rabbit']){
  const c=new Contract(deployed[k].address,collection.abi,wallet);
  await send('fund-'+k,{to:c.target,value:journal.initialReserveWei});
  const {receipt}=await send('canary-'+k,await c.mint.populateTransaction(1,{value:parseEther('0.001')}));
  const event=receipt.logs.map(l=>{try{return c.interface.parseLog(l);}catch{return null;}}).find(e=>e?.name==='MintRequested');need(event,'Canary mint request missing');const seq=event.args.sequence;
  for(let tries=0;tries<90;tries++){const r=await c.requests(seq);if(r.settled)break;const n=await c.nextToSettle();if((await c.requests(n)).ready)await send(`settle-${k}-${n}`,await c.settleNext.populateTransaction(n));else await new Promise(r=>setTimeout(r,4000));}
  need((await c.requests(seq)).settled,'VRF pending; restart this same workflow later without redeploying');const ids=await c.requestTokens(seq);need(ids.length===1&&await c.ownerOf(ids[0])===ACCOUNT,'Canary ownership mismatch');need(await c.tokenURI(ids[0])==='https://zhongqiu.sh'+cfg.prefix+`/${k}/metadata/${ids[0]}.json`,'Canary metadata mismatch');deployed[k].canaryTokenId=Number(ids[0]);
 }
 for(const k of ['change','rabbit','market']){
  const addr=deployed[k].address,a=k==='market'?market:collection,contractIdentifier=k==='market'?'MoonMarket.sol:MoonMarket':'MoonCollection.sol:MoonCollection';
  const v=await fetch(`https://sourcify.dev/server/v2/verify/56/${addr}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stdJsonInput:input,compilerVersion:JSON.parse(a.metadata).compiler.version,contractIdentifier,creationTransactionHash:deployed[k].transactionHash})});
  if(!v.ok)console.log('Source submission status',k,v.status);
  let verified=false;for(let i=0;i<45;i++){const r=await fetch(`https://sourcify.dev/server/v2/contract/56/${addr}`);if(r.ok){const result=await r.json();if(['exact_match','match'].includes(result.match)){verified=true;break;}}await new Promise(r=>setTimeout(r,4000));}
  need(verified,'Source verification pending; contracts remain deployed but website sales stay closed');deployed[k].source='https://repo.sourcify.dev/56/'+addr;
 }
 const release={status:'verified',chainId:56,priceBNB:'0.001',revenue:REVENUE,manifestSha256:cfg.manifestSha256,...deployed};
 await fs.mkdir(new URL('../build/dual/',import.meta.url),{recursive:true});await fs.writeFile(new URL('../build/dual/deployment.json',import.meta.url),JSON.stringify(release,null,2));
 const p='sites/zhongqiu/dist/nft/deployment.json',prior=await api('GET',`/contents/${p}?ref=${SITE}`);
 await api('PUT',`/contents/${p}`,{branch:SITE,sha:prior.sha,message:'Enable verified BNB Chain NFT collections and market',content:Buffer.from(JSON.stringify(release,null,2)).toString('base64')});
 console.log('Mainnet release verified and website deployment triggered',JSON.stringify(release));
}
if(process.argv[1]?.endsWith('/deploy.mjs'))main().catch(e=>{console.error(e instanceof Stop?e.message:'Deployment stopped; check RPC, website assets and checkpoint. Secret values are never printed.');process.exitCode=1;});
