import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeFunctionData, parseAbi, encodeEventTopics, encodeAbiParameters, keccak256 } from 'viem';
import { plan, fresh, validate, callFor, reserve, next, persistThenBroadcast, ACCOUNT, TOKEN, DISTRIBUTOR, artifact, batchId } from './airdrop-core.mjs';
import { options, verifyDelivery } from './airdrop-run.mjs';
import { compact, hydrate } from './airdrop-store.mjs';
test('execution requires explicit manual main-branch confirmation; checks never need a key',()=>{
 assert.equal(options({}).execute,false);
 assert.throws(()=>options({AIRDROP_MODE:'execute'}));
 const env={AIRDROP_MODE:'execute',AIRDROP_CONFIRM:'20x200x7',GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REPOSITORY:'xuxi1234/flap-stock-meme',GITHUB_REF:'refs/heads/main'};
 assert.equal(options(env).execute,true);assert.throws(()=>options({...env,GITHUB_EVENT_NAME:'push'}));assert.throws(()=>options({...env,GITHUB_REF:'refs/heads/evil'}));
});
test('a single displayed transfer cannot pass a 200-recipient receipt check',()=>{
 assert.throws(()=>verifyDelivery({kind:'send',batch:0},[]));
});
test('20 batches have 4000 unique recipients and total 28000 exact tokens', () => {
 const p=plan(); assert.equal(p.length,20); assert.equal(new Set(p.flat()).size,4000); assert.ok(p.every(b=>b.length===200));
 const c=callFor({kind:'send',batch:19}); const d=decodeFunctionData({abi:parseAbi(['function distribute(address,bytes32,address[],uint256[])']),data:c.data});
 assert.equal(d.args[2].length,200); assert.equal(d.args[3].reduce((a,b)=>a+b,0n),1400000000000000000000n); assert.equal(c.value,0n);
 assert.throws(()=>callFor({kind:'send',batch:20})); assert.throws(()=>callFor({kind:'transferBNB'}));
});
test('budget includes historical outgoing value and failed gas; exceeding cap stops',()=>{
 assert.equal(reserve(31134577509141262n,1000000n,60000000n),60000000000000n);
 assert.throws(()=>reserve(99999999999999999n,1n,2n)); assert.throws(()=>reserve(0n,17000000n,60000000n));
});
test('completed batches never get sent again; failed and pending stop forward progress',()=>{
 const j=fresh(); assert.equal(next(j,28000000000000000000000n).batch,0);
 j.entries.push({kind:'send',batch:0,settled:true,success:true}); assert.equal(next(j,26600000000000000000000n).batch,1);
 j.entries.push({kind:'send',batch:1,settled:false}); assert.throws(()=>next(j,0n));
 j.entries[1].settled=true;j.entries[1].success=false;assert.throws(()=>next(j,0n));
});
test('allowance is limited to remainder and revoked when done',()=>{
 const j=fresh();assert.deepEqual(next(j,0n),{kind:'approve',amount:'28000000000000000000000'});
 assert.deepEqual(next(j,1n),{kind:'reset',amount:'0'});
 j.entries=Array.from({length:20},(_,batch)=>({kind:'send',batch,settled:true,success:true}));
 assert.equal(next(j,0n),null);assert.equal(next(j,1n).kind,'reset');
});
test('tampered campaign and transaction recipients cannot be resumed',()=>{
 const j=fresh();assert.doesNotThrow(()=>validate(j));j.account='0x0000000000000000000000000000000000000001';assert.throws(()=>validate(j));
 const q=fresh();q.entries=[{kind:'send',batch:0,transaction:{to:q.account,data:'0x',value:'0',nonce:5,gas:'1000000',gasPrice:'60000000'}}];assert.throws(()=>validate(q));
});
test('remote checkpoint must acknowledge signed hash before broadcasting',async()=>{
 const j=fresh(); const e={}; let sent=0;
 await assert.rejects(()=>persistThenBroadcast({journal:j,entry:e,raw:'0x1234',save:async()=>{throw Error('storage down')},broadcast:async()=>{sent++}}));assert.equal(sent,0);
 let persisted;await persistThenBroadcast({journal:j,entry:e,raw:'0x1234',save:async()=>{persisted=e.hash},broadcast:async raw=>{assert.equal(raw,'0x1234');assert.ok(persisted);sent++;return persisted}});assert.equal(sent,1);
 await assert.rejects(()=>persistThenBroadcast({journal:j,entry:e,raw:'0xabcd',save:async()=>{},broadcast:async()=>{sent++}}));assert.equal(sent,1);
});
test('full offline campaign exhausts exact approval after 20 rounds, and repeat run is a no-op',()=>{
 const j=fresh();let allowance=0n,spent=31134577509141262n,transferred=0n;const seen=new Set();
 for(let i=0;i<21;i++){
  const e=next(j,allowance);assert.ok(e);const c=callFor(e);reserve(spent,1000000n,60000000n);spent+=60000000000000n;
  if(e.kind==='approve')allowance=BigInt(e.amount);
  else{assert.equal(e.batch,i-1);for(const a of plan()[e.batch]){assert.ok(!seen.has(a));seen.add(a)}allowance-=1400000000000000000000n;transferred+=1400000000000000000000n;}
  j.entries.push({...e,transaction:{...c,value:'0',nonce:5+i,chainId:56,type:'legacy',gas:'1000000',gasPrice:'60000000'},hash:keccak256(c.data),settled:true,success:true});validate(j);
 }
 assert.equal(seen.size,4000);assert.equal(transferred,28000000000000000000000n);assert.equal(allowance,0n);assert.equal(next(j,allowance),null);assert.equal(spent,32394577509141262n);
 const wire=JSON.stringify(compact(j));assert.ok(wire.length<20000);const restored=hydrate(JSON.parse(wire));validate(restored);assert.equal(next(restored,0n),null);assert.deepEqual(restored,j);
});
function deliveryLogs(){
 const logs=plan()[0].map(recipient=>({address:DISTRIBUTOR,topics:encodeEventTopics({abi:artifact.abi,eventName:'Delivered',args:{sender:ACCOUNT,token:TOKEN,batchId:batchId(0)}}),data:encodeAbiParameters([{type:'address'},{type:'uint256'},{type:'uint256'}],[recipient,7000000000000000000n,7000000000000000000n])}));
 logs.push({address:DISTRIBUTOR,topics:encodeEventTopics({abi:artifact.abi,eventName:'BatchCompleted',args:{sender:ACCOUNT,token:TOKEN,batchId:batchId(0)}}),data:encodeAbiParameters([{type:'uint256'},{type:'uint256'}],[200n,1400000000000000000000n])});return logs;
}
test('receipt requires all 200 distinct exact recipients and seven actual tokens each',()=>{
 const logs=deliveryLogs();assert.equal(verifyDelivery({kind:'send',batch:0},logs).length,200);
 const duplicated=structuredClone(logs);duplicated[199]=duplicated[0];assert.throws(()=>verifyDelivery({kind:'send',batch:0},duplicated));
 const taxed=structuredClone(logs);taxed[0].data=encodeAbiParameters([{type:'address'},{type:'uint256'},{type:'uint256'}],[plan()[0][0],7000000000000000000n,6790000000000000000n]);assert.throws(()=>verifyDelivery({kind:'send',batch:0},taxed));
 assert.throws(()=>verifyDelivery({kind:'send',batch:1},logs));
});
