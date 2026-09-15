import fs from 'node:fs';
import {mergeRecipients} from './core.mjs';
import {OUT,hex,digest,safe,calls,rpc,rpcBatch,mapLimit,api,publish,BRANCH} from './io.mjs';
const TOKENS=JSON.parse(fs.readFileSync(new URL('./tokens.json',import.meta.url)));
async function main(){
 const snapshot=Number(process.env.HOLDERS_SNAPSHOT),tag=hex(snapshot);
 if(Number(BigInt(await rpc('eth_chainId',[])))!==56)throw new Error('Wrong chain');
 const block=await rpc('eth_getBlockByNumber',[tag,false]);
 const results=await mapLimit(TOKENS,async token=>{
  const f=await api('GET',`/contents/data/holders18/${token}.json?ref=${encodeURIComponent(BRANCH)}`);
  if(f.encoding!=='base64')throw new Error('Invalid token result');
  const r=JSON.parse(Buffer.from(f.content,'base64').toString('utf8'));
  if(r.token!==token||r.snapshotBlock!==snapshot||r.snapshotHash!==block.hash||r.verifiedBalanceSum!==r.totalSupply||r.top.length!==Math.min(600,r.positiveHolders))throw new Error('Incomplete or mixed snapshot');
  let next=r.creationBlock,count=0;
  for(const span of r.ranges){if(span.from!==next||span.to<span.from||span.to>snapshot)throw new Error('Missing or overlapping log range');next=span.to+1;count+=span.count;}
  if(next!==snapshot+1||count!==r.logCount)throw new Error('Log coverage is incomplete');
  const seen=new Set();r.top.forEach((row,i)=>{if(row.rank!==i+1||seen.has(row.address)||BigInt(row.balance)<=0n||i&&BigInt(r.top[i-1].balance)<BigInt(row.balance))throw new Error('Invalid ranking');seen.add(row.address);});
  return r;
 },4);
 const selected=[...new Set(results.flatMap(t=>t.top.map(h=>h.address)))];
 const groups=Array.from({length:Math.ceil(selected.length/100)},(_,i)=>selected.slice(i*100,i*100+100));
 const codes=Object.fromEntries((await mapLimit(groups,async group=>{
  const codes=await rpcBatch(group.map(a=>({method:'eth_getCode',params:[a,tag]})));return group.map((a,i)=>[a,codes[i]]);
 },2)).flat());
 const merged=mergeRecipients(results,codes,'0x74a7D3198905C3b4BA53574C2DffEF3aa4e569aA');
 const recipientText=merged.recipients.join('\n')+'\n';
 const status={complete:true,chainId:56,provider:'Alchemy BNB mainnet',run:process.env.GITHUB_RUN_ID,tokenCount:18,errors:[],snapshotBlock:snapshot,snapshotHash:block.hash,snapshotTime:new Date(Number(BigInt(block.timestamp))*1000).toISOString(),method:'Complete Transfer history; balanceOf for every candidate at fixed block; totalSupply reconciliation; rank top 600 before filtering',rawTopCount:results.reduce((n,t)=>n+t.top.length,0),uniqueBeforeFilter:selected.length,recipientCount:merged.recipients.length,excludedRows:merged.excluded.length,recipientSha256:digest(recipientText),tokens:results.map(({top,ranges,...r})=>r)};
 const files={'recipients.txt':recipientText,'provenance.json':JSON.stringify(merged.sources,null,2)+'\n','excluded.json':JSON.stringify(merged.excluded,null,2)+'\n','status.json':JSON.stringify(status,null,2)+'\n'};
 for(const [name,content] of Object.entries(files))fs.writeFileSync(OUT+'/'+name,content);
 await publish(files);
 const summary=`18/18 tokens verified at BSC block ${snapshot}. ${status.rawTopCount} ranked rows; ${status.recipientCount} unique eligible recipients. SHA256 ${status.recipientSha256}. Read-only; no transfers sent.`;
 console.log(summary);if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary+'\n');
}
main().catch(e=>{console.error(safe(e));process.exitCode=1;});
