import test from 'node:test';
import assert from 'node:assert/strict';
import {plan,callFor,TOTAL,fresh,validate,BASE_NONCE,ID} from './new72-core.mjs';
import {plan as oldPlan,ID as oldID} from './timed-airdrop-core.mjs';
test('new campaign contains72 independent rounds and excludes every old recipient',()=>{
 const p=plan(),old=new Set(oldPlan().flat());assert.equal(p.length,72);assert.equal(new Set(p.flat()).size,14400);assert.ok(p.flat().every(a=>!old.has(a)));assert.notEqual(ID,oldID);assert.equal(TOTAL,1440000000000000000000n);
});
test('new journal starts empty after old nonce42 and only permits batches0..71',()=>{
 assert.equal(BASE_NONCE,43);assert.equal(fresh().entries.length,0);validate(fresh());assert.doesNotThrow(()=>callFor({kind:'send',batch:71}));assert.throws(()=>callFor({kind:'send',batch:72}));
});
import {authorize} from './new72-schedule.mjs';
import {accountBudget,CHARGED_BASELINE,reserveCampaign} from './new72-budget.mjs';
import {history} from './new72-core.mjs';
const env={GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REPOSITORY:'xuxi1234/flap-stock-meme',GITHUB_REF:'refs/heads/main',NEW72_CONFIRM:'72x200x0.1',GITHUB_RUN_ID:'123'};
test('paused campaign cannot be reactivated by another slot of the same run',()=>{
 const j=fresh();authorize(j,env);j.active=false;assert.throws(()=>authorize(j,env));assert.equal(j.active,false);authorize(j,{...env,GITHUB_RUN_ID:'124'});assert.equal(j.active,true);
});
test('all49 historical transactions count against lifetime0.1 and cannot reset on resume',()=>{
 const rows=history.map(r=>({...r,data:r.data||'0x'}));assert.equal(rows.length,49);assert.equal(accountBudget(rows,true).spent,53882222469141262n);assert.equal(CHARGED_BASELINE,53882222469141262n);assert.equal(reserveCampaign(99999999999999999n,1n,1n),1n);assert.throws(()=>reserveCampaign(100000000000000000n,1n,1n));
});
