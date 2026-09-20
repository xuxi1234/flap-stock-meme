import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeFunctionData} from 'viem';
const core=await import('./image12-core.mjs');
test('fixed CSV produces 36 batches and exact 0.1-token calldata including final 18',async()=>{
 assert.ok(core,'image12 implementation must exist');
 const source=fs.readFileSync(new URL('./data/image12-recipients.txt',import.meta.url));
 const manifest=JSON.parse(fs.readFileSync(new URL('./data/image12-manifest.json',import.meta.url)));
 const prior=JSON.parse(fs.readFileSync(new URL('./data/image12-prior-image10.json',import.meta.url)));
 core.configure(source,manifest.recipientSha256,prior);
 const batches=core.plan();
 assert.equal(batches.length,36);assert.ok(batches.slice(0,35).every(b=>b.length===200));assert.equal(batches[35].length,18);
 assert.equal(new Set(batches.flat()).size,7018);
 assert.equal(createHash('sha256').update('\ufeffaddress\r\n'+batches.flat().join('\r\n')+'\r\n').digest('hex'),'5caf6e066a6b03347ab24fe3090f8ca2eaf6edf6a09788db7c1f3b1888ed20c8');
 assert.equal(core.TOTAL,701800000000000000000n);
 for(const batch of [0,35]){
  const d=decodeFunctionData({abi:core.artifact.abi,data:core.callFor({kind:'send',batch}).data});
  assert.equal(d.args[2].length,batch===0?200:18);
  assert.ok(d.args[3].every(a=>a===100000000000000000n));
 }
 assert.notEqual(core.ID,prior.id);
 assert.equal(core.BASE_NONCE,213);
 assert.throws(()=>core.buildPlan(Buffer.concat([source,Buffer.from('bad')]),manifest.recipientSha256));
 const schedule=await import('./image12-schedule.mjs');
 const j={entries:[{kind:'send',settled:true,success:true,confirmedAt:10000}]};
 assert.equal(schedule.isDue(j,11799),false);assert.equal(schedule.isDue(j,11800),true);
 assert.throws(()=>schedule.authorize(core.fresh(),{}));
});
test('old campaign must be unchanged and complete before new nonce is configured',async()=>{
 const {assertPrior72}=await import('./image12-main.mjs');
 const read=n=>JSON.parse(fs.readFileSync(new URL('./data/'+n,import.meta.url)));
 const prior=read('image12-prior-image10.json');
 const api=value=>async(method,path)=>{
  assert.equal(method,'GET');
  const j=path.includes('72x200')?read('holders18-prior71.json'):path.includes('holders18-ledger')?read('image10-prior-holders18.json'):value;
  const content=JSON.stringify(j);return {encoding:'base64',size:content.length,content:Buffer.from(content).toString('base64')};
 };
 await assertPrior72(api(prior));assert.equal(core.BASE_NONCE,213);
 await assert.rejects(assertPrior72(api({...prior,active:true})));
 await assert.rejects(assertPrior72(api({...prior,entries:prior.entries.slice(0,-1)})));
});
