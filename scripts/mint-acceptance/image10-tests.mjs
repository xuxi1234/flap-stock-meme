import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {buildPlan,configure,plan,fresh,BASE_NONCE,ID,batchId} from './image10-core.mjs';
import {dueAt,isDue,authorize,AUTHORIZATION} from './image10-schedule.mjs';
import {assertPrior72} from './image10-main.mjs';
import {compact,hydrate} from './image10-store.mjs';
const read=n=>JSON.parse(fs.readFileSync(new URL('./data/'+n,import.meta.url)));
const manifest=read('image10-manifest.json');
const source=fs.readFileSync(new URL('./data/image10-recipients.txt',import.meta.url));
const prior=read('image10-prior-holders18.json');
test('exact fixed 5774 recipients form 28 full batches and a final 174',()=>{
 const batches=buildPlan(source,manifest.recipientSha256);
 assert.equal(batches.length,29);assert.ok(batches.slice(0,28).every(b=>b.length===200));assert.equal(batches.at(-1).length,174);
 assert.equal(new Set(batches.flat()).size,5774);
 const csv='\ufeffaddress\r\n'+batches.flat().join('\r\n')+'\r\n';
 assert.equal(createHash('sha256').update(csv).digest('hex'),manifest.sha256);
 assert.throws(()=>buildPlan(Buffer.concat([source,Buffer.from('\n')]),manifest.recipientSha256));
 configure(source,manifest.recipientSha256,prior);assert.equal(BASE_NONCE,183);assert.notEqual(ID,prior.id);
 assert.equal(new Set(Array.from({length:29},(_,i)=>batchId(i))).size,29);
 assert.deepEqual(hydrate(compact(fresh())),fresh());
});
test('next batch is blocked until 1200 seconds after last confirmation',()=>{
 const j={entries:[{kind:'send',settled:true,success:true,confirmedAt:10000}]};
 assert.equal(dueAt(j),11200);assert.equal(isDue(j,11199),false);assert.equal(isDue(j,11200),true);
});
test('default and wrong confirmation cannot enable signing; manual main can',()=>{
 configure(source,manifest.recipientSha256,prior);const j=fresh();
 assert.throws(()=>authorize(j,{}));assert.equal(j.active,false);
 const env={GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REPOSITORY:'xuxi1234/flap-stock-meme',GITHUB_REF:'refs/heads/main',IMAGE10_CONFIRM:AUTHORIZATION,GITHUB_RUN_ID:'new-run'};
 assert.throws(()=>authorize(j,{...env,IMAGE10_CONFIRM:'holders18x1:200:1800seconds:budget0.2:lifetime'}));
 authorize(j,env);assert.equal(j.active,true);
 j.active=false;assert.throws(()=>authorize(j,env));
});
test('prior campaign must be finished, inactive, and unchanged before configuring nonce',async()=>{
 const prior71=read('holders18-prior71.json');
 const api=changed=>async(method,path)=>{assert.equal(method,'GET');const value=path.includes('72x200')?prior71:changed;const content=JSON.stringify(value);return {encoding:'base64',size:content.length,content:Buffer.from(content).toString('base64')};};
 await assertPrior72(api(prior));assert.equal(BASE_NONCE,183);assert.equal(plan().flat().length,5774);
 await assert.rejects(assertPrior72(api({...prior,active:true})));
 await assert.rejects(assertPrior72(api({...prior,entries:prior.entries.slice(0,-1)})));
});
