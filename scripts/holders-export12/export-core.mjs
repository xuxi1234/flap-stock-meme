export function mergeSnapshot(tokens,results,snapshot,hash){
 const address=/^0x[0-9a-f]{40}$/;
 const check=(ok,message)=>{if(!ok)throw new Error(message)};
 check(tokens.length>0&&tokens.every(t=>address.test(t))&&new Set(tokens).size===tokens.length,'Invalid token set');
 check(results.length===tokens.length,'Incomplete token set');
 const sources={};let rawTopCount=0;
 for(const [i,r] of results.entries()){
  check(r.token===tokens[i]&&r.snapshotBlock===snapshot&&r.snapshotHash===hash,'Mixed snapshot or token');
  const supply=BigInt(r.totalSupply),sum=BigInt(r.verifiedBalanceSum),gap=supply-sum;
  check(supply>0n&&sum<=supply&&r.coverageGap===gap.toString(),'Unverified holder coverage');
  check(Number.isSafeInteger(r.positiveHolders)&&r.positiveHolders>=0&&r.top.length===Math.min(600,r.positiveHolders),'Incomplete top holders');
  let next=r.creationBlock,count=0;
  for(const span of r.ranges){check(span.from===next&&span.to>=span.from&&span.to<=snapshot,'Incomplete log range');next=span.to+1;count+=span.count;}
  check(next===snapshot+1&&count===r.logCount,'Missing history');
  const seen=new Set();
  for(const [n,row] of r.top.entries()){
   check(address.test(row.address)&&!seen.has(row.address)&&row.rank===n+1&&BigInt(row.balance)>0n,'Invalid holder row');
   check(n===0||BigInt(r.top[n-1].balance)>=BigInt(row.balance),'Invalid ranking');
   seen.add(row.address);(sources[row.address]??=[]).push({token:r.token,rank:row.rank,balance:row.balance});rawTopCount++;
  }
  check(gap===0n||(r.top.length===600&&gap<BigInt(r.top[599].balance)),'Uncovered balance can affect top 600 ranking');
 }
 return {addresses:Object.keys(sources).sort(),sources,rawTopCount};
}
