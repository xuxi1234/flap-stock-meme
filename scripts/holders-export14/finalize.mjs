import fs from 'node:fs';
import {createHash} from 'node:crypto';
const tokens=JSON.parse(fs.readFileSync(new URL('./tokens.json',import.meta.url)));
const block=Number(process.env.HOLDERS_SNAPSHOT),hash=process.env.HOLDERS_SNAPSHOT_HASH;
const valid=/^0x[0-9a-f]{40}$/;
if(tokens.length!==14||new Set(tokens).size!==14||!tokens.every(t=>valid.test(t))||!Number.isSafeInteger(block)||!/^0x[0-9a-f]{64}$/.test(hash))throw Error('Invalid snapshot input');
const rows=tokens.map(t=>JSON.parse(fs.readFileSync('holder-input/'+t+'.json','utf8')));
const sources=new Map();let total=0;
for(let i=0;i<tokens.length;i++){
 const r=rows[i],sum=BigInt(r.verifiedBalanceSum),supply=BigInt(r.totalSupply),gap=supply-sum;
 if(r.token!==tokens[i]||r.snapshotBlock!==block||r.snapshotHash!==hash||sum>supply||gap.toString()!==r.coverageGap||r.top.length!==Math.min(1000,r.positiveHolders))throw Error('Incomplete holder proof: '+tokens[i]);
 let next=r.creationBlock,count=0;
 for(const span of r.ranges){if(span.from!==next||span.to<span.from||span.to>block)throw Error('Missing transfer logs');next=span.to+1;count+=span.count}
 if(next!==block+1||count!==r.logCount)throw Error('Missing transfer history');
 const seen=new Set();
 for(const [n,h] of r.top.entries()){
  if(!valid.test(h.address)||seen.has(h.address)||h.rank!==n+1||BigInt(h.balance)<=0n||(n&&BigInt(r.top[n-1].balance)<BigInt(h.balance)))throw Error('Invalid holder rank');
  seen.add(h.address);total++;let list=sources.get(h.address);if(!list)sources.set(h.address,list=[]);list.push({token:r.token,rank:h.rank});
 }
 if(gap!==0n&&(r.top.length<1000||gap>=BigInt(r.top[999].balance)))throw Error('Unproven top 1000: '+r.token);
}
const addresses=[...sources.keys()].sort();
fs.mkdirSync('holder-export',{recursive:true});
const csv='\ufeffaddress\r\n'+addresses.join('\r\n')+'\r\n';
fs.writeFileSync('holder-export/top1000-deduplicated.csv',csv);
const summary={complete:true,chainId:56,snapshotBlock:block,snapshotHash:hash,tokenCount:14,rawTopCount:total,uniqueAddresses:addresses.length,duplicatesRemoved:total-addresses.length,deduplicationOnly:true,excludedAddresses:0,sha256:createHash('sha256').update(csv).digest('hex'),tokens:rows.map(({top,ranges,...rest})=>rest)};
fs.writeFileSync('holder-export/summary.json',JSON.stringify(summary,null,2)+'\n');
fs.writeFileSync('holder-export/sources.json',JSON.stringify(Object.fromEntries(sources),null,2)+'\n');
console.log(JSON.stringify(summary));
