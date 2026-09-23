import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeAbiParameters,encodeEventTopics} from 'viem';
import * as c from './moon7031-core.mjs';
import {executionAllowed,confirmedBlocks} from './moon7031-run.mjs';
import {compact,hydrate} from './moon7031-store.mjs';
const entry=(batch,nonce,at)=>({kind:'send',batch,settled:true,success:true,hash:'0x'+String(nonce).padStart(64,'0'),confirmedAt:at,transaction:{...c.callFor({kind:'send',batch}),nonce,chainId:56,type:'legacy',gas:'10000000',gasPrice:'60000000'}});
test('fixed 7031 recipients, 36 batches, last31, exact1 each',()=>{assert.equal(c.addresses.length,7031);assert.equal(c.plan[35].length,31);assert.equal(c.TOTAL,7031n*10n**18n);assert.equal(new Set(c.plan.map((_,i)=>c.batchId(i))).size,36);assert.equal(c.TOKEN,'0xe5f69232e5312dff8b3f0f82cf2bdfe80a517777');});
test('only confirmed dispatch on main can execute',()=>{const e={GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'xuxi1234/flap-stock-meme',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_dispatch',MOON7031_CONFIRM:c.CONFIRM};assert.equal(executionAllowed(e),true);for(const patch of [{GITHUB_EVENT_NAME:'push'},{GITHUB_REF:'refs/heads/other'},{MOON7031_CONFIRM:''}])assert.equal(executionAllowed({...e,...patch}),false);});
test('strict batches, nonce, interval and checkpoint roundtrip',()=>{const j={...c.fresh(),baseNonce:400,entries:[entry(0,400,1000),entry(1,401,1300)]};c.validate(j);assert.equal(c.dueAt(j),1600);assert.deepEqual(hydrate(compact(j)),j);for(const bad of [j=>j.entries[1].confirmedAt=1299,j=>j.entries[1].transaction.nonce=403,j=>j.entries[1].batch=0,j=>j.token=c.ACCOUNT]){const x=structuredClone(j);bad(x);assert.throws(()=>c.validate(x));}});
test('reset old allowance, approve exact remainder, then next batch',()=>{const j=c.fresh();assert.equal(c.next(j,100n).kind,'reset');assert.equal(c.next(j,0n).amount,c.TOTAL.toString());assert.deepEqual(c.next(j,c.TOTAL),{kind:'send',batch:0});});
test('store acknowledgement required before any broadcast',async()=>{let sent=0;const e={};await assert.rejects(c.persistThenBroadcast({journal:{},entry:e,raw:'0x1234',save:async()=>{throw Error('no write');},broadcast:async()=>{sent++;}}));assert.equal(sent,0);assert.match(e.hash,/^0x[0-9a-f]{64}$/);await assert.rejects(c.persistThenBroadcast({journal:{},entry:e,raw:'0x1235',save:async()=>{},broadcast:async()=>{sent++;}}));assert.equal(sent,0);});
test('all 31 final recipients and exact gross amounts required; tax tracked',()=>{const args={sender:c.ACCOUNT,token:c.TOKEN,batchId:c.batchId(35)};const logs=c.plan[35].map(recipient=>({address:c.DISTRIBUTOR,topics:encodeEventTopics({abi:c.artifact.abi,eventName:'Delivered',args}),data:encodeAbiParameters([{type:'address'},{type:'uint256'},{type:'uint256'}],[recipient,c.AMOUNT,c.AMOUNT*97n/100n])}));logs.push({address:c.DISTRIBUTOR,topics:encodeEventTopics({abi:c.artifact.abi,eventName:'BatchCompleted',args}),data:encodeAbiParameters([{type:'uint256'},{type:'uint256'}],[31n,31n*c.AMOUNT])});assert.equal(c.deliveries({kind:'send',batch:35},logs).length,31);assert.throws(()=>c.deliveries({kind:'send',batch:35},logs.slice(1)));});

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
