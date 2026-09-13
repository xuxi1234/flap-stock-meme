import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {decodeFunctionData} from 'viem';
let C,S;
try{C=await import('./csv600-core.mjs');S=await import('./csv600-schedule.mjs');}catch{}
test('CSV plan includes first row and transfers exactly one token to each supplied address',()=>{
 assert.ok(C,'CSV600 implementation is missing');
 const source=fs.readFileSync(new URL('./data/csv600-source.csv',import.meta.url),'utf8').trim().split(/\r?\n/);
 const seen=[];for(let i=0;i<3;i++){const c=C.callFor({kind:'send',batch:i});const d=decodeFunctionData({abi:C.artifact.abi,data:c.data});assert.equal(c.value,0n);assert.equal(d.functionName,'distribute');assert.equal(d.args[2].length,200);assert.ok(d.args[3].every(a=>a===1000000000000000000n));seen.push(...d.args[2].map(a=>a.toLowerCase()));}
 assert.deepEqual(seen,source.map(a=>a.toLowerCase()));assert.equal(new Set(seen).size,600);assert.equal(seen[0],'0x407993575c91ce7643a4d4ccacc9a98c36ee1bbe');
 assert.throws(()=>C.callFor({kind:'send',batch:3}));assert.throws(()=>C.callFor({kind:'approve',amount:'601000000000000000000'}));
});
test('retry rejects another campaign, changed nonce and repeated batch',()=>{
 assert.ok(C);const j=C.fresh();const e={kind:'send',batch:0,transaction:{...C.callFor({kind:'send',batch:0}),value:'0',nonce:72,chainId:56,type:'legacy',gas:'11000000',gasPrice:'60000000'},settled:false};j.entries.push(e);C.validate(j);e.transaction.nonce=73;assert.throws(()=>C.validate(j));e.transaction.nonce=72;j.id='0x'+'0'.repeat(64);assert.throws(()=>C.validate(j));
});
test('180-second interval is measured from prior receipt, never submission',()=>{
 assert.ok(S);const j={entries:[{kind:'send',settled:true,success:true,confirmedAt:1000}]};assert.equal(S.isDue(j,1179),false);assert.equal(S.isDue(j,1180),true);assert.equal(S.isDue({entries:[]},1000),true);
});
test('existing costs remain charged under lifetime 0.1 BNB budget',()=>{
 assert.ok(C);assert.throws(()=>C.reserve(99999999999999999n,21000n,50000000n));assert.equal(C.reserve(70942515369141262n,11000000n,60000000n),660000000000000n);
});
test('all three confirmed batches produce no further transfer',()=>{
 assert.ok(C);const j=C.fresh();j.entries=[0,1,2].map(batch=>({kind:'send',batch,settled:true,success:true}));assert.equal(C.next(j,0n),null);assert.deepEqual(C.next(j,1n),{kind:'reset',amount:'0'});
});
test('new task cannot run after old checkpoint changes or while old run is active',async()=>{
 let m;try{m=await import('./csv600-main.mjs');}catch{}assert.ok(m,'entry point is missing');
 const old=fs.readFileSync(new URL('./data/csv600-prior72.json',import.meta.url),'utf8');
 const api=async(method,url)=>url.includes('/actions/runs/')?{status:'completed',conclusion:'cancelled'}:{encoding:'base64',size:old.length,content:Buffer.from(old).toString('base64')};
 await m.assertPrior72(api);
 await assert.rejects(()=>m.assertPrior72(async(method,url)=>url.includes('/actions/runs/')?{status:'in_progress'}:api(method,url)));
 const changed=JSON.parse(old);changed.entries.pop();await assert.rejects(()=>m.assertPrior72(async(method,url)=>url.includes('/actions/runs/')?api(method,url):{encoding:'base64',size:old.length,content:Buffer.from(JSON.stringify(changed)).toString('base64')}));
});
