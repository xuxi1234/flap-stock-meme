import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {candidates,selectTop,mergeRecipients,scanRanges,rpcError} from './core.mjs';
const TOKENS=JSON.parse(fs.readFileSync(new URL('./tokens.json',import.meta.url)));
const RPC=process.env.FLAP_BSC_RPC_URL;
if(!RPC||new URL(RPC).hostname!=='bnb-mainnet.g.alchemy.com')throw new Error('Alchemy BSC mainnet RPC is required');
const OUT=process.env.HOLDERS_OUTPUT||'holders18-output';fs.mkdirSync(OUT,{recursive:true});
const hex=n=>'0x'+BigInt(n).toString(16);
const digest=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const safe=e=>String(e.message).replace(/https?:\/\/\S+/g,'[endpoint]').replace(/alch_[\w-]+/g,'[key]').slice(0,400);
let calls=0,requestId=0;
async function rpc(method,params){
 if(!['eth_chainId','eth_blockNumber','eth_getBlockByNumber','eth_getCode','eth_getLogs','eth_call','eth_getBalance','eth_getTransactionCount'].includes(method))throw new Error('Read-only method required');
 for(let attempt=0;attempt<5;attempt++){
  if(++calls>200000)throw new Error('Read request limit reached');
  try{
   const r=await fetch(RPC,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++requestId,method,params}),signal:AbortSignal.timeout(45000)});
   const j=await r.json().catch(()=>({}));
   if(!r.ok||j.error)throw rpcError(method,r.status,j);
   if(j.result===undefined)throw new Error('Missing RPC result');return j.result;
  }catch(e){if(e.range||attempt===4)throw e;await pause(500*2**attempt);}
 }
}
async function mapLimit(items,fn,limit=8){let index=0;const out=Array(items.length);await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(index<items.length){const i=index++;out[i]=await fn(items[i],i);}}));return out;}
const REPO='xuxi1234/flap-stock-meme',BRANCH='automation/holders18-snapshot';
async function api(method,path,body){const r=await fetch('https://api.github.com/repos/'+REPO+path,{method,headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error('GitHub '+r.status);return r.json();}
async function publish(files){
 if(!process.env.GITHUB_TOKEN)return;
 let ref;try{ref=await api('GET','/git/ref/heads/'+BRANCH);}catch(e){if(e.message!=='GitHub 404')throw e;const base=await api('GET','/git/ref/heads/main');await api('POST','/git/refs',{ref:'refs/heads/'+BRANCH,sha:base.object.sha});ref=await api('GET','/git/ref/heads/'+BRANCH);}
 const parent=await api('GET','/git/commits/'+ref.object.sha);
 const tree=await api('POST','/git/trees',{base_tree:parent.tree.sha,tree:Object.entries(files).map(([path,content])=>({path:'data/holders18/'+path,mode:'100644',type:'blob',content}))});
 const commit=await api('POST','/git/commits',{message:'Record read-only 18-token holder snapshot',tree:tree.sha,parents:[ref.object.sha]});
 await api('PATCH','/git/refs/heads/'+BRANCH,{sha:commit.sha,force:false});
}
const status={complete:false,chainId:56,provider:'Alchemy BNB mainnet',run:process.env.GITHUB_RUN_ID,tokenCount:TOKENS.length,tokens:[],errors:[],method:'Full Transfer history from deployment; balanceOf for every candidate at one fixed block; rank before filtering'};
const write=(name,value)=>{const text=typeof value==='string'?value:JSON.stringify(value,null,2)+'\n';fs.writeFileSync(OUT+'/'+name,text);return text;};
async function main(){
 if(Number(BigInt(await rpc('eth_chainId',[])))!==56)throw new Error('Wrong chain');
 const snapshot=Number(BigInt(await rpc('eth_blockNumber',[])))-30,tag=hex(snapshot);
 const block=await rpc('eth_getBlockByNumber',[tag,false]);Object.assign(status,{snapshotBlock:snapshot,snapshotHash:block.hash,snapshotTime:new Date(Number(BigInt(block.timestamp))*1000).toISOString()});
 await publish({'status.json':write('status.json',status)});
 for(const token of TOKENS){
  try{
   console.log('TOKEN_START',token,'requests',calls);
   if(await rpc('eth_getCode',[token,tag])==='0x')throw new Error('No contract at snapshot');
   let lo=0,hi=snapshot;while(lo<hi){const mid=Math.floor((lo+hi)/2);if(await rpc('eth_getCode',[token,hex(mid)])==='0x')lo=mid+1;else hi=mid;}
   const creationBlock=lo;
   const supply=BigInt(await rpc('eth_call',[{to:token,data:'0x18160ddd'},tag]));
   const decimals=Number(BigInt(await rpc('eth_call',[{to:token,data:'0x313ce567'},tag])));
   let symbol='';try{const v=await rpc('eth_call',[{to:token,data:'0x95d89b41'},tag]);const b=Buffer.from(v.slice(2),'hex');symbol=b.length===32?b.toString('utf8').replace(/\0/g,''):b.subarray(64,64+Number(BigInt('0x'+b.subarray(32,64).toString('hex')))).toString('utf8');}catch{}
   const ranges=[];let logCount=0;const allCandidates=new Set();
   // Start with 50k blocks. Subdivide explicitly when provider caps are hit.
   for(let start=creationBlock;start<=snapshot;start+=50000){
    const end=Math.min(snapshot,start+49999);
    const logs=await scanRanges(async(from,to)=>{
     const rows=await rpc('eth_getLogs',[{address:token,fromBlock:hex(from),toBlock:hex(to),topics:['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef']}]);
     if(rows.length>=10000&&from<to)throw Object.assign(new Error('Potential capped result'),{range:true});
     for(const l of rows)if(l.address.toLowerCase()!==token||Number(BigInt(l.blockNumber))<from||Number(BigInt(l.blockNumber))>to)throw new Error('Invalid log response');
     ranges.push({from,to,count:rows.length,sha256:digest(rows)});return rows;
    },start,end);
    logCount+=logs.length;for(const a of candidates(logs))allCandidates.add(a);
    console.log('LOG_PROGRESS',token,end+'/'+snapshot,'candidates',allCandidates.size,'logs',logCount);
   }
   const addresses=[...allCandidates].sort();
   const balances=await mapLimit(addresses,async(address,i)=>{const balance=BigInt(await rpc('eth_call',[{to:token,data:'0x70a08231'+address.slice(2).padStart(64,'0')},tag]));if(i%1000===0)console.log('BALANCE_PROGRESS',token,i+'/'+addresses.length);return {address,balance:balance.toString()};});
   const sum=balances.reduce((s,x)=>s+BigInt(x.balance),0n);
   // A mismatch means Transfer-based discovery is not demonstrably complete.
   if(sum!==supply)throw new Error('Holder coverage balance sum '+sum+' differs from totalSupply '+supply);
   const top=selectTop(balances);
   const result={token,symbol,decimals,creationBlock,snapshotBlock:snapshot,snapshotHash:block.hash,totalSupply:supply.toString(),verifiedBalanceSum:sum.toString(),candidateCount:addresses.length,positiveHolders:balances.filter(x=>BigInt(x.balance)>0n).length,logCount,balanceSha256:digest(balances),ranges,top};
   write(token+'-all-balances.json',balances);
   status.tokens.push(result);
   await publish({[token+'.json']:write(token+'.json',result),'status.json':write('status.json',{...status,tokens:status.tokens.map(({top,ranges,...r})=>r),requests:calls})});
   console.log('TOKEN_DONE',token,'holders',result.positiveHolders,'top',top.length);
  }catch(e){const error={token,error:safe(e)};status.errors.push(error);console.log('TOKEN_FAILED',JSON.stringify(error));await publish({'status.json':write('status.json',{...status,tokens:status.tokens.map(({top,ranges,...r})=>r),requests:calls})});}
 }
 if(status.errors.length||status.tokens.length!==18)throw new Error('Incomplete token set; no final recipient list released');
 if((await rpc('eth_getBlockByNumber',[tag,false])).hash!==block.hash)throw new Error('Snapshot reorg');
 const selected=[...new Set(status.tokens.flatMap(t=>t.top.map(h=>h.address)))];
 const codes=Object.fromEntries(await mapLimit(selected,async a=>[a,await rpc('eth_getCode',[a,tag])]));
 const merged=mergeRecipients(status.tokens,codes,'0x74a7D3198905C3b4BA53574C2DffEF3aa4e569aA');
 const recipientText=merged.recipients.join('\n')+'\n';
 Object.assign(status,{complete:true,requests:calls,rawTopCount:status.tokens.reduce((n,t)=>n+t.top.length,0),uniqueBeforeFilter:selected.length,recipientCount:merged.recipients.length,excludedRows:merged.excluded.length,recipientSha256:digest(recipientText)});
 const files={'recipients.txt':write('recipients.txt',recipientText),'provenance.json':write('provenance.json',merged.sources),'excluded.json':write('excluded.json',merged.excluded),'status.json':write('status.json',{...status,tokens:status.tokens.map(({top,ranges,...r})=>r)})};
 await publish(files);console.log('COMPLETE',merged.recipients.length,'recipients',status.recipientSha256);
}
main().catch(async e=>{console.error(safe(e));status.fatal=safe(e);write('status.json',{...status,tokens:status.tokens.map(({top,ranges,...r})=>r)});process.exitCode=1;});
