import fs from 'node:fs';
import {rpc,hex,mapLimit,digest,safe} from './io.mjs';
import {candidates,selectTop,proveTopCoverage} from './core.mjs';
import {verifyMulticall,readBalances} from './multicall.mjs';
const token='0x205812cdbed920aff76c6580abd681a46d11efc7',snapshot=123648022,tag=hex(snapshot);
const expectedHash='0x3d5da5c00a735cbbe6ca22ccf568b3387b9f275e2ad39df7f0ee279622fc4b84';
const topic='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const out='rankproof-output';fs.mkdirSync(out,{recursive:true});
const known=new Set(),balances=new Map(),ranges=[];let logs=0;
async function scan(from,to){
 let rows;
 try {rows=await rpc('eth_getLogs',[{address:token,fromBlock:hex(from),toBlock:hex(to),topics:[topic]}]);if(rows.length>=10000)throw Object.assign(Error('capped'),{range:true});}
 catch(e){if(!e.range||from===to)throw e;const mid=Math.floor((from+to)/2);await scan(from,mid);await scan(mid+1,to);return;}
 for(const l of rows)if(l.address.toLowerCase()!==token||Number(BigInt(l.blockNumber))<from||Number(BigInt(l.blockNumber))>to)throw Error('invalid log');
 for(const a of candidates(rows))known.add(a);
 logs+=rows.length;ranges.push({from,to,count:rows.length,sha256:digest(rows)});
}
async function check(supply,decimals,creationBlock){
 const pending=[...known].filter(a=>!balances.has(a));
 const groups=Array.from({length:Math.ceil(pending.length/100)},(_,i)=>pending.slice(i*100,i*100+100));
 await mapLimit(groups,async group=>{
  const vals=await readBalances(group,rpc,token,tag);
  for(const n of new Set([0,group.length-1])){
   const direct=BigInt(await rpc('eth_call',[{to:token,data:'0x70a08231'+group[n].slice(2).padStart(64,'0')},tag]));
   if(direct!==BigInt(vals[n]))throw Error('Multicall mismatch');
  }
  group.forEach((a,i)=>balances.set(a,vals[i]));
 },4);
 const all=[...balances].map(([address,balance])=>({address,balance}));
 const sum=all.reduce((s,h)=>s+BigInt(h.balance),0n),top=selectTop(all,500),gap=supply-sum;
 if(gap<0n)throw Error('Balance sum exceeds supply');
 console.log('PROOF_PROGRESS',JSON.stringify({candidates:known.size,logs,gap:gap.toString(),cutoff:top.at(-1)?.balance}));
 if(gap!==0n&&(top.length<500||gap>=BigInt(top.at(-1).balance)))return false;
 const coverage=proveTopCoverage(sum,supply,top,500);
 if((await rpc('eth_getBlockByNumber',[tag,false])).hash!==expectedHash)throw Error('Snapshot reorg');
 const result={token,symbol:'',decimals,creationBlock,snapshotBlock:snapshot,snapshotHash:expectedHash,totalSupply:supply.toString(),verifiedBalanceSum:sum.toString(),...coverage,candidateCount:known.size,positiveHolders:all.filter(h=>BigInt(h.balance)>0n).length,logCount:logs,balanceSha256:digest(all),ranges,top};
 fs.writeFileSync(out+'/'+token+'.json',JSON.stringify(result));
 console.log('PROVEN_TOP500',top.length,coverage.coverageMode);return true;
}
async function main(){
 if(BigInt(await rpc('eth_chainId',[]))!==56n)throw Error('Wrong chain');
 if((await rpc('eth_getBlockByNumber',[tag,false])).hash!==expectedHash)throw Error('Wrong block');
 await verifyMulticall(rpc,tag);
 let lo=0,hi=snapshot;while(lo<hi){const mid=Math.floor((lo+hi)/2);if(await rpc('eth_getCode',[token,hex(mid)])==='0x')lo=mid+1;else hi=mid;}
 const creationBlock=lo,supply=BigInt(await rpc('eth_call',[{to:token,data:'0x18160ddd'},tag])),decimals=Number(BigInt(await rpc('eth_call',[{to:token,data:'0x313ce567'},tag])));
 const seedEnd=Math.min(snapshot,creationBlock+999);
 await scan(creationBlock,seedEnd);
 for(let end=snapshot;end>seedEnd;){
  const start=Math.max(seedEnd+1,end-499999);
  const starts=Array.from({length:Math.ceil((end-start+1)/10000)},(_,i)=>start+i*10000);
  const stop=end;
  await mapLimit(starts,s=>scan(s,Math.min(stop,s+9999)),12);
  console.log('WINDOW_DONE',start,end);
  if(await check(supply,decimals,creationBlock))return;
  end=start-1;
 }
 throw Error('No ranking proof');
}
main().catch(e=>{console.error(safe(e));process.exitCode=1;});
