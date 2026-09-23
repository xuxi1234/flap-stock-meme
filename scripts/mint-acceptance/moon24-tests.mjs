import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeAbiParameters,encodeEventTopics} from 'viem';
import * as c from './moon24-core.mjs';
import {executionAllowed,confirmedBlocks} from './moon24-run.mjs';
import {compact,hydrate} from './moon24-store.mjs';
const entry=(batch,nonce,at)=>({kind:'send',batch,settled:true,success:true,hash:'0x'+String(nonce).padStart(64,'0'),confirmedAt:at,transaction:{...c.callFor({kind:'send',batch}),nonce,chainId:56,type:'legacy',gas:'10000000',gasPrice:'60000000'}});
test('fixed 22533 recipients, 113 batches, last133, exact1 each',()=>{assert.equal(c.addresses.length,22533);assert.equal(c.plan[112].length,133);assert.equal(c.TOTAL,22533n*10n**18n);assert.equal(new Set(c.plan.map((_,i)=>c.batchId(i))).size,113);assert.equal(c.TOKEN,'0xe5f69232e5312dff8b3f0f82cf2bdfe80a517777');});
test('only confirmed dispatch on main can execute',()=>{const e={GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'xuxi1234/flap-stock-meme',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_dispatch',MOON24_CONFIRM:c.CONFIRM};assert.equal(executionAllowed(e),true);for(const patch of [{GITHUB_EVENT_NAME:'push'},{GITHUB_REF:'refs/heads/other'},{MOON24_CONFIRM:''}])assert.equal(executionAllowed({...e,...patch}),false);});
test('strict batches, nonce, interval and checkpoint roundtrip',()=>{const j={...c.fresh(),baseNonce:400,entries:[entry(0,400,1000),entry(1,401,1900)]};c.validate(j);assert.equal(c.dueAt(j),2800);assert.deepEqual(hydrate(compact(j)),j);for(const bad of [j=>j.entries[1].confirmedAt=1899,j=>j.entries[1].transaction.nonce=403,j=>j.entries[1].batch=0,j=>j.token=c.ACCOUNT]){const x=structuredClone(j);bad(x);assert.throws(()=>c.validate(x));}});
test('reset old allowance, approve exact remainder, then next batch',()=>{const j=c.fresh();assert.equal(c.next(j,100n).kind,'reset');assert.equal(c.next(j,0n).amount,c.TOTAL.toString());assert.deepEqual(c.next(j,c.TOTAL),{kind:'send',batch:0});});
test('store acknowledgement required before any broadcast',async()=>{let sent=0;const e={};await assert.rejects(c.persistThenBroadcast({journal:{},entry:e,raw:'0x1234',save:async()=>{throw Error('no write');},broadcast:async()=>{sent++;}}));assert.equal(sent,0);assert.match(e.hash,/^0x[0-9a-f]{64}$/);await assert.rejects(c.persistThenBroadcast({journal:{},entry:e,raw:'0x1235',save:async()=>{},broadcast:async()=>{sent++;}}));assert.equal(sent,0);});
test('all 133 final recipients and exact gross amounts required; tax tracked',()=>{const args={sender:c.ACCOUNT,token:c.TOKEN,batchId:c.batchId(112)};const logs=c.plan[112].map(recipient=>({address:c.DISTRIBUTOR,topics:encodeEventTopics({abi:c.artifact.abi,eventName:'Delivered',args}),data:encodeAbiParameters([{type:'address'},{type:'uint256'},{type:'uint256'}],[recipient,c.AMOUNT,c.AMOUNT*97n/100n])}));logs.push({address:c.DISTRIBUTOR,topics:encodeEventTopics({abi:c.artifact.abi,eventName:'BatchCompleted',args}),data:encodeAbiParameters([{type:'uint256'},{type:'uint256'}],[133n,133n*c.AMOUNT])});assert.equal(c.deliveries({kind:'send',batch:112},logs).length,133);assert.throws(()=>c.deliveries({kind:'send',batch:112},logs.slice(1)));});

test('confirmation lag waits for both fresh heads without broadcasting',async()=>{
 let polls=0,waits=0;
 const clients=[0,1].map(i=>({getBlock:async()=>({hash:'0xab',timestamp:1000n}),getBlockNumber:async options=>{assert.equal(options.cacheTime,0);polls++;return i===1&&waits===0?110n:111n;}}));
 const blocks=await confirmedBlocks(clients,{blockNumber:'0x64',blockHash:'0xab'},{pause:async()=>{waits++;},now:()=>0});
 assert.equal(waits,1);assert.equal(polls,4);assert.equal(blocks.length,2);
});
test('confirmation timeout and block disagreement stop safely',async()=>{
 let time=0;
 const client={getBlock:async()=>({hash:'0xab',timestamp:1000n}),getBlockNumber:async()=>110n};
 await assert.rejects(confirmedBlocks([client,client],{blockNumber:'0x64',blockHash:'0xab'},{pause:async()=>{time+=3000;},now:()=>time,timeout:3000}),/12确认超时/);
 await assert.rejects(confirmedBlocks([client,client],{blockNumber:'0x64',blockHash:'0xcd'}),/区块不一致/);
});

test('all 113 batches fit journal and complete at exactly 22533 recipients',()=>{
 const entries=c.plan.map((_,i)=>entry(i,400+i,1000+i*900));
 const j={...c.fresh(),baseNonce:400,entries};c.validate(j);
 assert.equal(c.completed(j),113);assert.equal(c.next(j,0n),null);
 assert.equal(c.plan.flat().length,22533);assert.equal(c.INTERVAL,900);
 assert.equal(c.dueAt(j),1000+113*900);
});
