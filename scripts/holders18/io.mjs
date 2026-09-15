import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {rpcError,decodeBatch} from './core.mjs';
const RPC=process.env.FLAP_BSC_RPC_URL;
if(!RPC||new URL(RPC).hostname!=='bnb-mainnet.g.alchemy.com')throw new Error('Alchemy BSC mainnet RPC is required');
const OUT=process.env.HOLDERS_OUTPUT||'holders18-output';fs.mkdirSync(OUT,{recursive:true});
const hex=n=>'0x'+BigInt(n).toString(16);
const digest=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const safe=e=>String(e.message).replace(/https?:\/\/\S+/g,'[endpoint]').replace(/alch_[\w-]+/g,'[key]').slice(0,400);
let calls=0,requestId=0,nextRequestAt=0;
// Six workers together stay below the observed 10,000 CU/s plan limit.
// Reserve a conservative 50 CU per balance/code read and 100 per other call.
async function throttle(cost){const at=Math.max(Date.now(),nextRequestAt);nextRequestAt=at+cost;await pause(Math.max(0,at-Date.now()));}

async function rpc(method,params){
 if(!['eth_chainId','eth_blockNumber','eth_getBlockByNumber','eth_getCode','eth_getLogs','eth_call','eth_getBalance','eth_getTransactionCount'].includes(method))throw new Error('Read-only method required');
 for(let attempt=0;attempt<12;attempt++){
  if(++calls>2000000)throw new Error('Read request limit reached');
  try{
   await throttle(method==='eth_call'||method==='eth_getCode'?50:100);
   const r=await fetch(RPC,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++requestId,method,params}),signal:AbortSignal.timeout(45000)});
   const j=await r.json().catch(()=>({}));
   if(!r.ok||j.error)throw rpcError(method,r.status,j);
   if(j.result===undefined)throw new Error('Missing RPC result');return j.result;
  }catch(e){if(e.range||attempt===11)throw e;await pause(Math.min(30000,1000*2**attempt)+Math.random()*1000);}
 }
}
async function mapLimit(items,fn,limit=8){
 let index=0,failure;const out=Array(items.length);
 await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{
  while(!failure&&index<items.length){const i=index++;try{out[i]=await fn(items[i],i);}catch(e){failure??=e;}}
 }));
 if(failure)throw failure;return out;
}
const REPO='xuxi1234/flap-stock-meme',BRANCH=process.env.HOLDERS_BRANCH||'automation/holders18-snapshot';
async function api(method,path,body){const r=await fetch('https://api.github.com/repos/'+REPO+path,{method,signal:AbortSignal.timeout(30000),headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error('GitHub '+r.status);return r.json();}
async function publish(files){
 if(!process.env.GITHUB_TOKEN)return;
 for(let attempt=0;attempt<12;attempt++){
  try{
   let ref;try{ref=await api('GET','/git/ref/heads/'+BRANCH);}catch(e){
    if(e.message!=='GitHub 404')throw e;
    const base=await api('GET','/git/ref/heads/main');
    try{await api('POST','/git/refs',{ref:'refs/heads/'+BRANCH,sha:base.object.sha});}catch(e){if(!/GitHub (409|422)/.test(e.message))throw e;}
    ref=await api('GET','/git/ref/heads/'+BRANCH);
   }
   const parent=await api('GET','/git/commits/'+ref.object.sha);
   const tree=await api('POST','/git/trees',{base_tree:parent.tree.sha,tree:Object.entries(files).map(([path,content])=>({path:'data/holders18/'+path,mode:'100644',type:'blob',content}))});
   const commit=await api('POST','/git/commits',{message:'Record read-only 18-token holder snapshot',tree:tree.sha,parents:[ref.object.sha]});
   await api('PATCH','/git/refs/heads/'+BRANCH,{sha:commit.sha,force:false});return;
  }catch(e){if(!/GitHub (409|422|429|5[0-9][0-9])/.test(e.message)||attempt===11)throw e;await pause(500+Math.random()*1500+attempt*300);}
 }
}
async function rpcBatch(requests){
 // Modest JSON-RPC batches reduce network overhead. Fall back to ordinary
 // read calls when this endpoint does not support a batch shape.
 const ids=requests.map(()=>++requestId);
 const body=requests.map((r,i)=>({jsonrpc:'2.0',id:ids[i],...r}));
 if(requests.some(r=>!['eth_call','eth_getCode'].includes(r.method)))throw new Error('Only readonly balance/code batches allowed');
 for(let attempt=0;attempt<12;attempt++){
  calls+=requests.length;if(calls>2000000)throw new Error('Read request limit reached');
  try{
   await throttle(requests.length*50);
   const r=await fetch(RPC,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
   const rows=await r.json();
   if(!Array.isArray(rows)&&r.status!==429&&r.status<500)return mapLimit(requests,r=>rpc(r.method,r.params),8);
   if(!r.ok)throw new Error('Batch HTTP '+r.status);
   return decodeBatch(rows,ids);
  }catch(e){if(attempt===11)throw e;await pause(Math.min(30000,1000*2**attempt)+Math.random()*1000);}
 }
}
export {OUT,hex,digest,pause,safe,calls,rpc,rpcBatch,mapLimit,api,publish,BRANCH};
