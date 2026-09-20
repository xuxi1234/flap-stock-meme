export const ZERO='0x'+'0'.repeat(40);
export function rpcError(method,status,body){const message=String(body?.error?.message||body?.message||'HTTP '+status).replace(/https?:\/\/\S+/g,'[endpoint]').replace(/alch_[\w-]+/g,'[key]');return Object.assign(new Error(method+' RPC '+(body?.error?.code??status)+': '+message),{range:method==='eth_getLogs'&&/range|limit.*log|too many|response.*size|query returned/i.test(message)});}
export function candidates(logs){
 const out=new Set();for(const log of logs){if(log.removed)throw new Error('Removed log in finalized snapshot');if(log.topics.length!==3)throw new Error('Non ERC20 Transfer event');for(const topic of log.topics.slice(1)){if(!/^0x[0-9a-fA-F]{64}$/.test(topic))throw new Error('Malformed Transfer topic');const a='0x'+topic.slice(-40).toLowerCase();if(a!==ZERO)out.add(a);}}
 return [...out].sort();
}
export function selectTop(rows,n=600){return rows.filter(x=>BigInt(x.balance)>0n).sort((a,b)=>BigInt(a.balance)>BigInt(b.balance)?-1:BigInt(a.balance)<BigInt(b.balance)?1:a.address.localeCompare(b.address)).slice(0,n).map((r,i)=>({...r,rank:i+1}));}
export function proveTopCoverage(sum,supply,top,n=600){
 sum=BigInt(sum);supply=BigInt(supply);
 if(sum>supply)throw new Error('Holder coverage balance sum exceeds totalSupply');
 const gap=supply-sum;
 if(gap===0n)return {coverageGap:'0',coverageMode:'exact'};
 if(top.length<n)throw new Error('Holder coverage is incomplete and fewer than '+n+' holders were found');
 const cutoff=BigInt(top[n-1].balance);
 // Every undiscovered holder is bounded by the total undiscovered balance.
 // A strict gap < cutoff therefore proves none can enter the reported top N.
 if(gap>=cutoff)throw new Error('Uncovered balance can affect top '+n+' ranking');
 return {coverageGap:gap.toString(),coverageMode:'rank-proven',topCutoffBalance:cutoff.toString()};
}
export function mergeRecipients(tokens,codes,sender){
 const excluded=[],sources={};
 const deny=new Set([ZERO,'0x000000000000000000000000000000000000dead',sender.toLowerCase(),...tokens.map(x=>x.token.toLowerCase())]);
 for(const t of tokens)for(const h of t.top){const a=h.address.toLowerCase();if(!(a in codes))throw new Error('Missing code classification');const reason=deny.has(a)?'zero/burn/sender/token':codes[a]!=='0x'?'contract':null;if(reason){excluded.push({token:t.token,...h,reason});continue;}(sources[a]??=[]).push({token:t.token,rank:h.rank,balance:h.balance});}
 return {recipients:Object.keys(sources).sort(),sources,excluded};
}
export async function scanRanges(fetchRange,from,to){
 try{return await fetchRange(from,to);}catch(e){if(!e.range||from===to)throw e;const mid=Math.floor((from+to)/2);return [...await scanRanges(fetchRange,from,mid),...await scanRanges(fetchRange,mid+1,to)];}
}
export function decodeBatch(rows,ids){
 if(!Array.isArray(rows)||rows.length!==ids.length)throw new Error('Incomplete batch response');
 const map=new Map();for(const row of rows){if(map.has(row.id)||!ids.includes(row.id)||row.error||row.result===undefined)throw new Error('Invalid batch response');map.set(row.id,row.result);}
 return ids.map(id=>{if(!map.has(id))throw new Error('Missing batch id');return map.get(id);});
}
