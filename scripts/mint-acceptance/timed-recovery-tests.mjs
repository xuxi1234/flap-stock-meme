import test from 'node:test';
import assert from 'node:assert/strict';
import { readWithRetry } from './rpc-read-retry.mjs';
import { runSlot } from './timed-airdrop-chain.mjs';
test('read retries transient transport failures but never retries a validation stop',async()=>{
 let calls=0,waits=[];
 const result=await readWithRetry(async()=>{calls++;if(calls<3){const e=Error('not logged');e.name='HttpRequestError';throw e;}return 42;},'回执',{wait:async n=>waits.push(n)});
 assert.equal(result,42);assert.equal(calls,3);assert.equal(waits.length,2);
 calls=0;await assert.rejects(()=>readWithRetry(async()=>{calls++;throw Error('validation');},'回执',{wait:async()=>{}}));assert.equal(calls,1);
});
test('exhausted RPC failure has safe stage-only diagnostic without endpoint secrets',async()=>{
 const error=Object.assign(Error('https://rpc.example/secret-value private-key'),{name:'HttpRequestError'});
 await assert.rejects(()=>readWithRetry(async()=>{throw error},'读取回执',{wait:async()=>{}}),e=>e.message.includes('读取回执')&&!e.message.includes('secret-value')&&!e.message.includes('private-key'));
});
test('remaining29 slots retain first delivery, wait1200s, total30 and no extra send',async()=>{
 let now=10000,executions=0;const j={entries:[{kind:'send',settled:true,success:true,confirmedAt:10000}]};
 const seen=[];
 for(let i=0;i<30;i++)await runSlot({load:async()=>structuredClone(j),now:()=>now,sleep:async ms=>{now+=ms/1000},execute:async()=>{executions++;seen.push(now);j.entries.push({kind:'send',settled:true,success:true,confirmedAt:now});},log:()=>{}});
 assert.equal(executions,29);assert.equal(j.entries.length,30);assert.equal(seen[0],11200);assert.equal(seen.at(-1),44800);
 assert.ok(seen.every((n,i)=>i===0||n-seen[i-1]>=1200));
});
test('failed execution stops the queued slot without retrying any transfer',async()=>{
 let count=0;await assert.rejects(()=>runSlot({load:async()=>({entries:[]}),now:()=>10000,sleep:async()=>{},execute:async()=>{count++;throw Error('failed')},log:()=>{}}));assert.equal(count,1);
});
test('a newly reverted receipt stops the slot immediately without another execution call',async()=>{
 let count=0;const j={entries:[]};
 await assert.rejects(()=>runSlot({load:async()=>structuredClone(j),now:()=>10000,sleep:async()=>{},execute:async()=>{count++;if(count>1)throw Error('unexpected second execution');j.entries.push({kind:'send',settled:true,success:false});},log:()=>{}}));
 assert.equal(count,1);
});
