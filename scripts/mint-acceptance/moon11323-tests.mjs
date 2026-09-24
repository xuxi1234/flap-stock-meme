import test from 'node:test';
import assert from 'node:assert/strict';
import * as c from './moon11323-core.mjs';
import {executionAllowed} from './moon11323-run.mjs';
test('fixed recipients and complete 30-minute plan',()=>{
 assert.equal(c.addresses.length,11323);
 assert.equal(c.plan.length,57);
 assert.equal(c.plan[56].length,123);
 assert.equal(c.plan.flat().length,11323);
 assert.equal(new Set(c.addresses.map(x=>x.toLowerCase())).size,11323);
 assert.equal(c.INTERVAL,1800);
 assert.equal(c.TOTAL,11323n*10n**18n);
 assert.ok(!c.addresses.includes('0x000000000000000000000000000000000000dead'));
});
test('execution guard and distinct batch identifiers',()=>{
 const env={GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'xuxi1234/flap-stock-meme',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_dispatch',MOON11323_CONFIRM:c.CONFIRM};
 assert.equal(executionAllowed(env),true);
 assert.equal(executionAllowed({...env,GITHUB_REF:'refs/heads/other'}),false);
 assert.equal(new Set(c.plan.map((_,i)=>c.batchId(i))).size,57);
});
