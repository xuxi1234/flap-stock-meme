import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {buildPlan,reserve,configure,fresh,validate,callFor,BASE_NONCE} from './holders18-core.mjs';
import {dueAt,isDue} from './holders18-schedule.mjs';
import {encodeEventTopics,encodeAbiParameters} from 'viem';
import {artifact,ACCOUNT,TOKEN,DISTRIBUTOR,batchId} from './holders18-core.mjs';
import {verifyDelivery} from './holders18-run.mjs';
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
test('user-selected snapshot preserves all 9992 addresses, including dead, in 50 batches',()=>{
 const raw=readFileSync(new URL('./data/holders18-recipients.txt',import.meta.url));
 const manifest=JSON.parse(readFileSync(new URL('./data/holders18-manifest.json',import.meta.url)));
 const batches=buildPlan(raw,manifest.recipientSha256);
 assert.equal(manifest.recipientSha256,'50addc10eb955343f01f0d054d750bf570f42b6e6796766c368f402d592cbce2');
 assert.equal(manifest.tokenCount,17);assert.equal(manifest.originalCollectionComplete,false);
 assert.equal(batches.length,50);assert.ok(batches.slice(0,49).every(b=>b.length===200));assert.equal(batches[49].length,192);
 assert.deepEqual(batches.flat(),raw.toString().trim().split('\n'));
 assert.ok(batches.flat().includes('0x000000000000000000000000000000000000dead'));
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

test('records net delivery while still rejecting wrong recipients, amounts and batch events',()=>{
 const one=address(0)+'\n';configure(one,createHash('sha256').update(one).digest('hex'),{version:3,entries:[{transaction:{nonce:130},settled:true,success:true}]});
 const args={sender:ACCOUNT,token:TOKEN,batchId:batchId(0)};
 const delivery=(recipient=address(0),requested=1000000000000000000n,received=970000000000000000n)=>({address:DISTRIBUTOR,topics:encodeEventTopics({abi:artifact.abi,eventName:'Delivered',args}),data:encodeAbiParameters([{type:'address'},{type:'uint256'},{type:'uint256'}],[recipient,requested,received])});
 const end={address:DISTRIBUTOR,topics:encodeEventTopics({abi:artifact.abi,eventName:'BatchCompleted',args}),data:encodeAbiParameters([{type:'uint256'},{type:'uint256'}],[1n,1000000000000000000n])};
 const verify=logs=>verifyDelivery({kind:'send',batch:0},logs);
 assert.equal(verify([delivery(),end])[0].received,'970000000000000000');
 assert.throws(()=>verify([delivery(address(1)),end]));
 assert.throws(()=>verify([delivery(address(0),970000000000000000n),end]));
 assert.throws(()=>verify([delivery(address(0),1000000000000000000n,0n),end]));
 assert.throws(()=>verify([delivery(address(0),1000000000000000000n,1000000000000000001n),end]));
 assert.throws(()=>verify([delivery()]));
 assert.throws(()=>verify([delivery(),delivery(),end]));
 assert.throws(()=>verifyDelivery({kind:'send',batch:1},[delivery(),end]));
});
