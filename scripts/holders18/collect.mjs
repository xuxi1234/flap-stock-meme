import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {candidates,selectTop,mergeRecipients,scanRanges,rpcError} from './core.mjs';
const TOKENS=JSON.parse(fs.readFileSync(new URL('./tokens.json',import.meta.url)));
import {OUT,hex,digest,pause,safe,calls,rpc,rpcBatch,mapLimit,api,publish,BRANCH} from './io.mjs';
const tokenIndex=process.env.HOLDERS_TOKEN_INDEX;
const WORK_TOKENS=tokenIndex===undefined?TOKENS:[TOKENS[Number(tokenIndex)]];
if(WORK_TOKENS.some(t=>!t))throw new Error('Invalid token index');
const statusName=tokenIndex===undefined?'status.json':`status-${tokenIndex}.json`;
const status={complete:false,chainId:56,provider:'Alchemy BNB mainnet',run:process.env.GITHUB_RUN_ID,tokenCount:TOKENS.length,tokens:[],errors:[],method:'Full Transfer history from deployment; balanceOf for every candidate at one fixed block; rank before filtering'};
const write=(name,value)=>{const text=typeof value==='string'?value:JSON.stringify(value,null,2)+'\n';fs.writeFileSync(OUT+'/'+name,text);return text;};
async function main(){
 if(Number(BigInt(await rpc('eth_chainId',[])))!==56)throw new Error('Wrong chain');
 const snapshot=process.env.HOLDERS_SNAPSHOT?Number(process.env.HOLDERS_SNAPSHOT):Number(BigInt(await rpc('eth_blockNumber',[])))-30,tag=hex(snapshot);
 if(!Number.isSafeInteger(snapshot)||snapshot<1)throw new Error('Invalid fixed snapshot');
 const block=await rpc('eth_getBlockByNumber',[tag,false]);Object.assign(status,{snapshotBlock:snapshot,snapshotHash:block.hash,snapshotTime:new Date(Number(BigInt(block.timestamp))*1000).toISOString()});
 await publish({[statusName]:write('status.json',status)});
 for(const token of WORK_TOKENS){
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
   const starts=Array.from({length:Math.ceil((snapshot-creationBlock+1)/50000)},(_,i)=>creationBlock+i*50000);
   await mapLimit(starts,async start=>{
    const end=Math.min(snapshot,start+49999);
    const logs=await scanRanges(async(from,to)=>{
     const rows=await rpc('eth_getLogs',[{address:token,fromBlock:hex(from),toBlock:hex(to),topics:['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef']}]);
     if(rows.length>=10000)throw Object.assign(new Error('Potential capped result'),{range:true});
     for(const l of rows)if(l.address.toLowerCase()!==token||Number(BigInt(l.blockNumber))<from||Number(BigInt(l.blockNumber))>to)throw new Error('Invalid log response');
     ranges.push({from,to,count:rows.length,sha256:digest(rows)});return rows;
    },start,end);
    logCount+=logs.length;for(const a of candidates(logs))allCandidates.add(a);
    console.log('LOG_PROGRESS',token,end+'/'+snapshot,'candidates',allCandidates.size,'logs',logCount);
   },4);
   ranges.sort((a,b)=>a.from-b.from);
   const addresses=[...allCandidates].sort();
   const groups=Array.from({length:Math.ceil(addresses.length/100)},(_,i)=>addresses.slice(i*100,i*100+100));
   const balances=(await mapLimit(groups,async(group,i)=>{
    const results=await rpcBatch(group.map(address=>({method:'eth_call',params:[{to:token,data:'0x70a08231'+address.slice(2).padStart(64,'0')},tag]})));
    if(i%10===0)console.log('BALANCE_PROGRESS',token,i*100+'/'+addresses.length);
    return group.map((address,n)=>({address,balance:BigInt(results[n]).toString()}));
   },2)).flat();
   const sum=balances.reduce((s,x)=>s+BigInt(x.balance),0n);
   // A mismatch means Transfer-based discovery is not demonstrably complete.
   if(sum!==supply)throw new Error('Holder coverage balance sum '+sum+' differs from totalSupply '+supply);
   const top=selectTop(balances);
   const result={token,symbol,decimals,creationBlock,snapshotBlock:snapshot,snapshotHash:block.hash,totalSupply:supply.toString(),verifiedBalanceSum:sum.toString(),candidateCount:addresses.length,positiveHolders:balances.filter(x=>BigInt(x.balance)>0n).length,logCount,balanceSha256:digest(balances),ranges,top};
   write(token+'-all-balances.json',balances);
   status.tokens.push(result);
   await publish({[token+'.json']:write(token+'.json',result),[statusName]:write('status.json',{...status,tokens:status.tokens.map(({top,ranges,...r})=>r),requests:calls})});
   console.log('TOKEN_DONE',token,'holders',result.positiveHolders,'top',top.length);
  }catch(e){const error={token,error:safe(e)};status.errors.push(error);console.log('TOKEN_FAILED',JSON.stringify(error));await publish({[statusName]:write('status.json',{...status,tokens:status.tokens.map(({top,ranges,...r})=>r),requests:calls})});}
 }
 if(tokenIndex!==undefined){if(status.errors.length)throw new Error('Token collection failed');return;}
 if(status.errors.length||status.tokens.length!==18)throw new Error('Incomplete token set; no final recipient list released');
 if((await rpc('eth_getBlockByNumber',[tag,false])).hash!==block.hash)throw new Error('Snapshot reorg');
 const selected=[...new Set(status.tokens.flatMap(t=>t.top.map(h=>h.address)))];
 const codes=Object.fromEntries(await mapLimit(selected,async a=>[a,await rpc('eth_getCode',[a,tag])]));
 const merged=mergeRecipients(status.tokens,codes,'0x74a7D3198905C3b4BA53574C2DffEF3aa4e569aA');
 const recipientText=merged.recipients.join('\n')+'\n';
 Object.assign(status,{complete:true,requests:calls,rawTopCount:status.tokens.reduce((n,t)=>n+t.top.length,0),uniqueBeforeFilter:selected.length,recipientCount:merged.recipients.length,excludedRows:merged.excluded.length,recipientSha256:digest(recipientText)});
 const files={'recipients.txt':write('recipients.txt',recipientText),'provenance.json':write('provenance.json',merged.sources),'excluded.json':write('excluded.json',merged.excluded),[statusName]:write('status.json',{...status,tokens:status.tokens.map(({top,ranges,...r})=>r)})};
 await publish(files);console.log('COMPLETE',merged.recipients.length,'recipients',status.recipientSha256);
}
main().catch(async e=>{console.error(safe(e));status.fatal=safe(e);write('status.json',{...status,tokens:status.tokens.map(({top,ranges,...r})=>r)});process.exitCode=1;});
