import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildPlan,reserve,configure,fresh,validate,callFor,BASE_NONCE} from './holders18-core.mjs';
import {dueAt,isDue} from './holders18-schedule.mjs';
const address=n=>'0x'+(BigInt(n)+1000000n).toString(16).padStart(40,'0');
const source=Array.from({length:401},(_,i)=>address(i)).join('\n')+'\n';
const sha=createHash('sha256').update(source).digest('hex');
test('fixed list divides 401 recipients into 200/200/1 without duplicates',()=>{
 assert.deepEqual(buildPlan(source,sha).map(x=>x.length),[200,200,1]);
 assert.throws(()=>buildPlan(source+'\n',sha));
 const duplicate=address(1)+'\n'+address(1)+'\n';assert.throws(()=>buildPlan(duplicate,createHash('sha256').update(duplicate).digest('hex')));
});
test('gas cap includes 0.099777690609141262 historical BNB and cannot reset',()=>{
 assert.equal(reserve(99777690609141262n,11000000n,50000000n),550000000000000n);
 assert.throws(()=>reserve(199900000000000000n,11000000n,50000000n));
 assert.throws(()=>reserve(-1n,11000000n,50000000n));
});
test('a second batch waits 1800 seconds after first confirmed block',()=>{
 const j={entries:[{kind:'send',settled:true,success:true,confirmedAt:100000}]};
 assert.equal(dueAt(j),101800);assert.equal(isDue(j,101799),false);assert.equal(isDue(j,101800),true);
});
test('new campaign continues wallet nonce and rejects duplicate batch and altered calldata',()=>{
 configure(source,sha,{version:3,entries:[{transaction:{nonce:130},settled:true,success:true}]});
 assert.equal(BASE_NONCE,131);
 const j=fresh();const e={kind:'send',batch:0,transaction:{...callFor({kind:'send',batch:0}),nonce:131,chainId:56,type:'legacy',value:'0',gas:'11000000',gasPrice:'50000000'},settled:true,success:true,hash:'0x'+'a'.repeat(64)};
 j.entries.push(e);validate(j);
 const bad=structuredClone(j);bad.entries.push({...e,transaction:{...e.transaction,nonce:132}});assert.throws(()=>validate(bad));
 e.transaction.data='0x';assert.throws(()=>validate(j));
});
