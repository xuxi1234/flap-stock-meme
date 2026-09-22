import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {decodeFunctionData,encodeEventTopics,encodeAbiParameters} from 'viem';
import * as core from './snapshot0922-core.mjs';
import {isDue,authorize,AUTHORIZATION} from './snapshot0922-schedule.mjs';
import {runSlot} from './snapshot0922-chain.mjs';
import {accountBudget,OWNED_RETURN,reserveCampaign} from './snapshot0922-budget.mjs';
import {verifyDelivery} from './snapshot0922-run.mjs';
import {assertPrior72,options} from './snapshot0922-main.mjs';
import {compact,hydrate,openGitHubStore} from './snapshot0922-store.mjs';
const read=n=>JSON.parse(fs.readFileSync(new URL('./data/'+n,import.meta.url)));
const source=fs.readFileSync(new URL('./data/snapshot0922-recipients.txt',import.meta.url));
const manifest=read('snapshot0922-manifest.json');
const prior={version:1,id:'fixture',active:false,entries:Array.from({length:28},(_,i)=>({kind:'send',batch:i,settled:true,success:true,transaction:{nonce:250+i}}))};
const setup=()=>core.configure(source,manifest.recipientSha256,prior);setup();
test('7031 unique addresses, 36 batches, exact amounts, same IDs as wallet page',()=>{
 setup();assert.equal(core.BATCHES,36);assert.equal(core.BASE_NONCE,278);assert.equal(core.plan().at(-1).length,31);assert.equal(core.TOTAL,5468008700000000000000n);
 const web=JSON.parse(fs.readFileSync(new URL('../../public/airdrop-7031/plan.json',import.meta.url)));
 assert.deepEqual(core.plan().flat(),web.addresses);
 for(let i=0;i<36;i++){const decoded=decodeFunctionData({abi:core.artifact.abi,data:core.callFor({kind:'send',batch:i}).data});assert.equal(decoded.args[1],web.batchIds[i]);assert.deepEqual(decoded.args[2].map(x=>x.toLowerCase()),core.plan()[i]);assert.ok(decoded.args[3].every(x=>x===core.AMOUNT));}
 assert.throws(()=>core.configure(Buffer.concat([source,Buffer.from('bad')]),manifest.recipientSha256,prior));setup();
});
test('no cumulative or per-transaction BNB fee cap; still rejects invalid gas inputs',()=>{
 assert.equal(core.BUDGET,null);assert.equal(core.reserve(10n**22n,100000n,10n**15n),10n**20n);assert.equal(reserveCampaign(10n**22n,100000n,10n**15n),10n**20n);
 assert.throws(()=>core.reserve(0n,0n,1n));assert.throws(()=>core.reserve(-1n,21000n,1n));
 const rows=[{...OWNED_RETURN,nonce:5},...Array.from({length:5},(_,nonce)=>({hash:'0x'+String(nonce+1).padStart(64,'0'),from:OWNED_RETURN.from,nonce,feeWei:'0',valueWei:'0',success:true})),{hash:'0x'+'a'.repeat(64),from:core.ACCOUNT,nonce:0,feeWei:'1000000000000000000',valueWei:'0',success:true}];
 assert.equal(accountBudget(rows,true).spent,1000001050000000000n);assert.throws(()=>accountBudget(rows,false));
});
test('full 60-minute interval, exactly one completed send per slot',async()=>{
 setup();let now=10000;const j={entries:[{kind:'send',settled:true,success:true,confirmedAt:now}]};assert.equal(isDue(j,13599),false);assert.equal(isDue(j,13600),true);let sent=0;
 await runSlot({load:async()=>j,now:()=>now,sleep:async ms=>{now+=ms/1000;},log:()=>{},execute:async()=>{assert.ok(now>=13600);sent++;j.entries.push({kind:'send',settled:true,success:true,confirmedAt:now});}});assert.equal(sent,1);
});
test('explicit manual main-branch confirmation is mandatory',()=>{
 setup();const env={GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REPOSITORY:'xuxi1234/flap-stock-meme',GITHUB_REF:'refs/heads/main',SNAPSHOT0922_CONFIRM:AUTHORIZATION,GITHUB_RUN_ID:'1'};
 assert.throws(()=>authorize(core.fresh(),{...env,SNAPSHOT0922_CONFIRM:''}));assert.throws(()=>authorize(core.fresh(),{...env,GITHUB_EVENT_NAME:'push'}));assert.throws(()=>authorize(core.fresh(),{...env,GITHUB_REF:'refs/heads/other'}));
 const j=core.fresh();authorize(j,env);assert.equal(j.active,true);assert.throws(()=>options({...env,SNAPSHOT0922_PHASE:'execute',SNAPSHOT0922_OPERATION:'check'}));
});
test('persistence failure prevents broadcast, deterministic hash retained for recovery',async()=>{
 const entry={};let sent=0;await assert.rejects(core.persistThenBroadcast({journal:{},entry,raw:'0x1234',save:async()=>{throw Error('storage failed');},broadcast:async()=>{sent++;}}));assert.equal(sent,0);assert.match(entry.hash,/^0x[0-9a-f]{64}$/);
});
test('only exact stopped 24-batch checkpoint may hand over to nonce 284',async()=>{
 const api=state=>async(method,path)=>{assert.equal(method,'GET');const value=path.includes('72x200')?read('holders18-prior71.json'):path.includes('holders18-ledger')?read('image10-prior-holders18.json'):path.includes('image10-ledger')?read('image12-prior-image10.json'):path.includes('image12-ledger')?read('snapshot0921-prior-image12.json'):state;const s=JSON.stringify(value);return {encoding:'base64',size:s.length,content:Buffer.from(s).toString('base64')};};
 const stopped=read('snapshot0922-stopped-prior.json');
 await assert.rejects(assertPrior72(api(prior)));
 await assert.rejects(assertPrior72(api({...stopped,entries:stopped.entries.slice(0,-1)})));
 await assertPrior72(api(stopped));assert.equal(core.BATCHES,36);assert.equal(core.BASE_NONCE,284);
});

test('final batch validates 31 actual delivery events and records net tax without reissuing',()=>{
 setup();const args={sender:core.ACCOUNT,token:core.TOKEN,batchId:core.batchId(35)};
 const logs=core.plan()[35].map((recipient,i)=>({address:core.DISTRIBUTOR,topics:encodeEventTopics({abi:core.artifact.abi,eventName:'Delivered',args}),data:encodeAbiParameters([{type:'address'},{type:'uint256'},{type:'uint256'}],[recipient,core.AMOUNT,i?core.AMOUNT:core.AMOUNT*97n/100n])}));
 logs.push({address:core.DISTRIBUTOR,topics:encodeEventTopics({abi:core.artifact.abi,eventName:'BatchCompleted',args}),data:encodeAbiParameters([{type:'uint256'},{type:'uint256'}],[31n,31n*core.AMOUNT])});assert.equal(verifyDelivery({kind:'send',batch:35},logs).length,31);assert.throws(()=>verifyDelivery({kind:'send',batch:34},logs));
});
test('checkpoint round trip preserves exact transaction; nonce or target tampering fails',()=>{
 setup();const j=core.fresh();const e={kind:'send',batch:0,settled:false};e.transaction={...core.callFor(e),value:'0',nonce:278,chainId:56,type:'legacy',gas:'1000000',gasPrice:'1000000000'};j.entries.push(e);core.validate(j);
 assert.deepEqual(hydrate(compact(j)),j);assert.throws(()=>core.validate({...j,entries:[{...e,transaction:{...e.transaction,nonce:279}}]}));assert.throws(()=>core.validate({...j,entries:[{...e,transaction:{...e.transaction,to:core.ACCOUNT}}]}));
});
