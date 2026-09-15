import test from 'node:test';
import assert from 'node:assert/strict';
import {accountBudget,OWNED_RETURN} from './holders18-budget.mjs';
import {ACCOUNT} from './holders18-core.mjs';
const rows=()=>[...Array.from({length:6},(_,nonce)=>nonce===5?{...OWNED_RETURN}:{from:OWNED_RETURN.from,nonce,hash:'0x'+String(nonce+1).padStart(64,'0'),feeWei:'1000',valueWei:'0',success:true}),{from:ACCOUNT,nonce:0,hash:'0x'+'f'.repeat(64),feeWei:'100000000000000000',valueWei:'0',success:true}];
test('full historical costs cross the old 0.1 cap, retain gas on sole principal exclusion',()=>{
 const r=rows(),b=accountBudget(r,true);assert.equal(b.spent,100001050000005000n);assert.equal(b.excluded,BigInt(OWNED_RETURN.valueWei));assert.equal(b.raw-b.excluded,b.spent);
 const bad=rows();bad.at(-1).feeWei='200000000000000000';assert.throws(()=>accountBudget(bad,true));
});
test('missing nonce, duplicate history, altered exclusion and unconfirmed accounting fail closed',()=>{
 assert.throws(()=>accountBudget(rows().slice(1),true));
 const r=rows();assert.throws(()=>accountBudget([...r,r.at(-1)],true));
 r[5].feeWei='0';assert.throws(()=>accountBudget(r,true));
 assert.throws(()=>accountBudget(rows(),false));
});
