import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeSnapshot} from './export-core.mjs';
const a=n=>'0x'+n.toString(16).padStart(40,'0');
const tokens=[a(1),a(2)],hash='0x'+'a'.repeat(64);
const make=(token,addresses)=>({token,snapshotBlock:100,snapshotHash:hash,totalSupply:'100',verifiedBalanceSum:'100',positiveHolders:addresses.length,creationBlock:90,logCount:2,ranges:[{from:90,to:100,count:2}],top:addresses.map((address,i)=>({address,rank:i+1,balance:String(100-i)}))});
const results=()=>[make(tokens[0],[a(10),a(11)]),make(tokens[1],[a(10),'0x000000000000000000000000000000000000dead'])];
test('deduplicates across tokens, preserves burn address, records both sources',()=>{
 const r=mergeSnapshot(tokens,results(),100,hash);
 assert.deepEqual(r.addresses,[a(10),a(11),'0x000000000000000000000000000000000000dead']);
 assert.equal(r.rawTopCount,4);assert.equal(r.sources[a(10)].length,2);
});
test('incomplete, mixed, wrongly ranked or unverified snapshot produces no export',()=>{
 for(const change of [r=>r.pop(),r=>r[1].snapshotBlock++,r=>r[1].verifiedBalanceSum='99',r=>r[1].ranges[0].from++,r=>r[1].top[0].balance='0',r=>r[1].top[1].rank=1,r=>r[1].positiveHolders=600,r=>r[1].token=tokens[0]]){
  const r=results();change(r);assert.throws(()=>mergeSnapshot(tokens,r,100,hash));
 }
});
