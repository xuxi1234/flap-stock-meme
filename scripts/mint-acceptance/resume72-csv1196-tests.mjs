import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validate,next,callFor} from './new72-core.mjs';
import {hydrate,compact} from './new72-store.mjs';
import {reserveCampaign} from './new72-budget.mjs';
const prior=JSON.parse(fs.readFileSync(new URL('./data/resume72-before-csv1196.json',import.meta.url)));
const csv=JSON.parse(fs.readFileSync(new URL('./data/resume72-csv1196-completed.json',import.meta.url)));
const resume=()=>({...hydrate(structuredClone(prior)),version:3,resumeAfterCsv1196:csv.entries.at(-1).hash});
function append(j,nonce){const e=next(j,0n);j.entries.push({...e,transaction:{...callFor(e),value:'0',nonce,chainId:56,type:'legacy',gas:'74136',gasPrice:'50000000'},settled:false});return j;}
test('after 39 rounds and 8 CSV1196 transactions, resume accepts nonce98 without changing history',()=>{
 const j=resume();assert.doesNotThrow(()=>validate(append(j,98)));
 assert.deepEqual(compact(j).entries.slice(0,42),prior.entries);
 assert.equal(j.entries.at(-1).amount,'660000000000000000000');
 assert.deepEqual(next(resume(),660000000000000000000n),{kind:'send',batch:39});
});
test('resume rejects reused or unexplained nonces and changed completed history',()=>{
 for(const nonce of [90,97,99])assert.throws(()=>validate(append(resume(),nonce)));
 const changed=resume();changed.entries[40].feeWei='0';assert.throws(()=>validate(changed));
 const wrong=resume();wrong.resumeAfterCsv1196='wrong';assert.throws(()=>validate(wrong));
});
test('CSV1196 fees remain charged and lifetime spending cannot exceed 0.1 BNB',()=>{
 assert.equal(csv.entries.reduce((n,e)=>n+BigInt(e.feeWei),0n),3774100020000000n);
 assert.equal(BigInt(prior.spentWei)+3774100020000000n,82930062009141262n);
 assert.throws(()=>reserveCampaign(99999000000000000n,21000n,50000000n));
});

import {prepareResume1196,assertCsv1196Rows} from './resume72-csv1196.mjs';
test('migration requires the exact completed CSV1196 checkpoint and never rewrites previous entries',()=>{
 const j=hydrate(structuredClone(prior)),migrated=prepareResume1196(j,csv);
 assert.equal(migrated.version,3);assert.equal(j.version,2);assert.deepEqual(migrated.entries,j.entries);
 assert.throws(()=>prepareResume1196(j,{...csv,active:true}));
 const changed=structuredClone(csv);changed.entries[0].feeWei='0';assert.throws(()=>prepareResume1196(j,changed));
 const rows=csv.entries.map(e=>({hash:e.hash,nonce:e.transaction.nonce,feeWei:e.feeWei,valueWei:'0',success:true}));
 assert.doesNotThrow(()=>assertCsv1196Rows(rows));assert.throws(()=>assertCsv1196Rows(rows.slice(1)));assert.throws(()=>assertCsv1196Rows([...rows,rows[0]]));
});
