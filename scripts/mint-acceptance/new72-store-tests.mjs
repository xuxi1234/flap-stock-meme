import test from 'node:test';
import assert from 'node:assert/strict';
import {openGitHubStore,blobSha,githubApi} from './new72-store.mjs';
import {fresh} from './new72-core.mjs';
const content=text=>({encoding:'base64',size:Buffer.byteLength(text),sha:blobSha(text),content:Buffer.from(text).toString('base64')});
const err=status=>Object.assign(new Error('transient'),{status});
const initial=()=>JSON.stringify(fresh())+'\n';
test('lost acknowledged write recovers by exact content without writing again',async()=>{
 let remote=initial(),writes=0;
 const api=async(method,url,body)=>{if(method==='GET')return content(remote);writes++;remote=Buffer.from(body.content,'base64').toString();throw err(500);};
 const s=await openGitHubStore({api,readOnly:false,wait:async()=>{}});s.journal.active=true;await s.save(s.journal);assert.equal(writes,1);assert.equal(JSON.parse(remote).active,true);
});
test('409 with unchanged remote content retries the same checkpoint',async()=>{
 let remote=initial(),writes=0;
 const api=async(method,url,body)=>{if(method==='GET')return content(remote);writes++;if(writes===1)throw err(409);remote=Buffer.from(body.content,'base64').toString();return {content:{sha:blobSha(remote)}};};
 const s=await openGitHubStore({api,readOnly:false,wait:async()=>{}});s.journal.active=true;await s.save(s.journal);assert.equal(writes,2);assert.equal(JSON.parse(remote).active,true);
});
test('409 with a different remote journal never overwrites concurrent progress',async()=>{
 let remote=initial(),writes=0;
 const api=async(method,url,body)=>{if(method==='GET')return content(remote);writes++;remote=JSON.stringify({...fresh(),stoppedBy:'another operator'})+'\n';throw err(409);};
 const s=await openGitHubStore({api,readOnly:false,wait:async()=>{}});s.journal.active=true;await assert.rejects(()=>s.save(s.journal));assert.equal(writes,1);assert.equal(JSON.parse(remote).stoppedBy,'another operator');
});
test('GET retries transient500 but does not retry forbidden403',async()=>{
 let calls=0;const api=githubApi('test-token',async()=>{calls++;return calls===1?{ok:false,status:500}:{ok:true,status:200,json:async()=>({ok:true})}},async()=>{});assert.deepEqual(await api('GET','/test'),{ok:true});assert.equal(calls,2);
 let denied=0;const bad=githubApi('test-token',async()=>{denied++;return {ok:false,status:403}},async()=>{});await assert.rejects(()=>bad('GET','/test'));assert.equal(denied,1);
});
