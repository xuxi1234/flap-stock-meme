import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validate, next, callFor } from './new72-core.mjs';
import { hydrate } from './new72-store.mjs';
import { prepareResume, CSV, assertCsvRows } from './resume72-interlude.mjs';
import { gasPriceFor } from './new72-run.mjs';
import { reserveCampaign } from './new72-budget.mjs';
const prior=JSON.parse(fs.readFileSync(new URL('./data/resume72-prior.json',import.meta.url)));
const resume=()=>({...hydrate(structuredClone(prior)),version:2,resumeAfterCsv600:'48b9be9f832ae2d1de9eee0c90c4151a2e580e9f'});
const append=(j,nonce)=>{const action=next(j,0n);j.entries.push({...action,transaction:{...callFor(action),value:'0',nonce,chainId:56,type:'legacy',gas:'74136',gasPrice:'60000000'},settled:false});return j;};
test('resume preserves 27 rounds and accepts nonce77 after the five CSV transactions',()=>{
 const j=resume();assert.doesNotThrow(()=>validate(append(j,77)));assert.equal(j.entries.at(-1).amount,'900000000000000000000');
 assert.deepEqual(next(resume(),900000000000000000000n),{kind:'send',batch:27});
});
test('resume rejects nonce reuse, unexplained gaps, missing or changed completed rounds',()=>{
 for(const nonce of [72,76,78])assert.throws(()=>validate(append(resume(),nonce)));
 const missing=resume();missing.entries.splice(5,1);assert.throws(()=>validate(missing));
 const changed=resume();changed.entries[4].hash='0x'+'1'.repeat(64);assert.throws(()=>validate(changed));
 const reverted=resume();reverted.entries[5].success=false;assert.throws(()=>validate(reverted));
 const wrong=resume();wrong.resumeAfterCsv600='other';assert.throws(()=>validate(wrong));
});
test('migration retains all confirmed entries and rejects a pending CSV campaign',()=>{
 const j=hydrate(structuredClone(prior));const migrated=prepareResume(j,CSV);
 assert.deepEqual(migrated.entries,j.entries);assert.equal(j.version,1);
 assert.throws(()=>prepareResume(j,{...CSV,active:true}));
 assert.throws(()=>prepareResume(j,{...CSV,entries:CSV.entries.slice(0,4)}));
 const changed=structuredClone(CSV);changed.entries[0].feeWei='0';assert.throws(()=>prepareResume(j,changed));
});
test('budget requires every CSV fee exactly once and keeps lifetime cap after resuming',()=>{
 const rows=CSV.entries.map(e=>({hash:e.hash,nonce:e.transaction.nonce,feeWei:e.feeWei,valueWei:'0',success:true}));
 assert.doesNotThrow(()=>assertCsvRows(rows));
 assert.throws(()=>assertCsvRows(rows.slice(1)));assert.throws(()=>assertCsvRows([...rows,rows[0]]));
 assert.throws(()=>reserveCampaign(99999000000000000n,21000n,50000000n),/累计/);
});
test('resume takes the higher of both live gas prices without a markup',async()=>{
 const clients=[{getGasPrice:async()=>40000000n},{getGasPrice:async()=>50000000n}];
 assert.equal(await gasPriceFor(clients,resume()),50000000n);
 assert.equal(await gasPriceFor(clients,{version:1}),48000000n);
 await assert.rejects(()=>gasPriceFor([{getGasPrice:async()=>0n},clients[1]],resume()),/Gas/);
});
