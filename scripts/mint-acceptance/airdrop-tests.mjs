import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeFunctionData, parseAbi, encodeEventTopics, encodeAbiParameters, keccak256, toHex } from 'viem';
import { plan, fresh, validate, callFor, reserve, next, persistThenBroadcast, ACCOUNT, TOKEN, DISTRIBUTOR, artifact, batchId, history, erc20 } from './airdrop-core.mjs';
import { options, verifyDelivery, nonceCheck, run } from './airdrop-run.mjs';
import { compact, hydrate } from './airdrop-store.mjs';
import { accountBudget, reserveCampaign, OWNED_RETURN, CHARGED_BASELINE, RAW_BASELINE, CAMPAIGN_GAS_CAP } from './airdrop-budget.mjs';
test('owned-return exception requires explicit approval and retains its gas',()=>{
 const rows=history.map(r=>({...r,data:r.data||'0x'}));
 assert.throws(()=>accountBudget(rows,false),/确认/);
 const b=accountBudget(rows,true);
 assert.equal(b.raw,RAW_BASELINE);assert.equal(b.spent,CHARGED_BASELINE);
 assert.equal(b.raw-b.spent,BigInt(OWNED_RETURN.valueWei));
 assert.equal(b.campaignGas,0n);
 for(const field of ['hash','from','to','nonce','valueWei','feeWei','success','data']){
  const bad=structuredClone(rows),r=bad.find(r=>r.hash===OWNED_RETURN.hash);
  r[field]=typeof r[field]==='number'?99:typeof r[field]==='boolean'?false:'0x0';
  assert.throws(()=>accountBudget(bad,true),field);
 }
 assert.equal(rows.find(r=>r.hash===OWNED_RETURN.hash).valueWei,OWNED_RETURN.valueWei);
});
test('new outgoing principal is never exempt and failed gas counts across resumes',()=>{
 const rows=history.map(r=>({...r,data:r.data||'0x'}));
 const extra={hash:'0x'+'a'.repeat(64),from:ACCOUNT,to:OWNED_RETURN.to,nonce:5,valueWei:'1000000000000000',feeWei:'1000000000000',success:true};
 assert.equal(accountBudget([...rows,extra],true).spent,CHARGED_BASELINE+1001000000000000n);
 extra.success=false;
 assert.equal(accountBudget([...rows,extra],true).spent,CHARGED_BASELINE+1000000000000n);
 extra.feeWei=(CAMPAIGN_GAS_CAP+1n).toString();
 assert.throws(()=>accountBudget([...rows,extra],true),/0.02/);
 assert.equal(reserveCampaign(CHARGED_BASELINE+CAMPAIGN_GAS_CAP-1n,1n,1n),1n);
 assert.throws(()=>reserveCampaign(CHARGED_BASELINE+CAMPAIGN_GAS_CAP,1n,1n),/0.02/);
});
test('execution requires explicit manual main-branch confirmation; checks never need a key',()=>{
 assert.equal(options({}).execute,false);
 assert.throws(()=>options({AIRDROP_MODE:'execute'}));
 const env={AIRDROP_MODE:'execute',AIRDROP_CONFIRM:'20x200x7',GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REPOSITORY:'xuxi1234/flap-stock-meme',GITHUB_REF:'refs/heads/main'};
 assert.throws(()=>options(env),/确认/);env.AIRDROP_OWNED_RETURN_CONFIRMED='true';
 assert.equal(options(env).execute,true);assert.throws(()=>options({...env,GITHUB_EVENT_NAME:'push'}));assert.throws(()=>options({...env,GITHUB_REF:'refs/heads/evil'}));
});
test('manual workflow defaults to no principal exclusion and isolates the private key',()=>{
 const y=readFileSync(new URL('../../.github/workflows/airdrop-20x200.yml',import.meta.url),'utf8');
 const [check,execute]=y.split('\n  execute:\n');
 assert.match(y,/owned_return_confirm:[\s\S]*?default: false/);
 assert.match(execute,/inputs\.confirm == true && inputs\.owned_return_confirm == true/);
 assert.ok(!check.includes('FLAP_MINT_PRIVATE_KEY'));
 assert.match(execute,/AIRDROP_OWNED_RETURN_CONFIRMED: \$\{\{ inputs\.owned_return_confirm \}\}/);
});
test('stored accounting fields cannot approve a subsequent execution',async()=>{
 const j=fresh();j.excludedPrincipalWei=OWNED_RETURN.valueWei;
 let touched=false;
 await assert.rejects(()=>run({clients:[],store:{journal:j,save:async()=>{touched=true}},execute:true,accountProvider:async()=>{touched=true}}),/确认/);
 assert.equal(touched,false);
});
test('a single displayed transfer cannot pass a 200-recipient receipt check',()=>{
 assert.throws(()=>verifyDelivery({kind:'send',batch:0},[]));
});
test('20 batches have 4000 unique recipients and total 28000 exact tokens', () => {
 const p=plan(); assert.equal(p.length,20); assert.equal(new Set(p.flat()).size,4000); assert.ok(p.every(b=>b.length===200));
 const c=callFor({kind:'send',batch:19}); const d=decodeFunctionData({abi:parseAbi(['function distribute(address,bytes32,address[],uint256[])']),data:c.data});
 assert.equal(d.args[2].length,200); assert.equal(d.args[3].reduce((a,b)=>a+b,0n),1400000000000000000000n); assert.equal(c.value,0n);
 assert.throws(()=>callFor({kind:'send',batch:20})); assert.throws(()=>callFor({kind:'transferBNB'}));
});
test('budget includes historical outgoing value and failed gas; exceeding cap stops',()=>{
 assert.equal(reserve(31134577509141262n,1000000n,60000000n),60000000000000n);
 assert.throws(()=>reserve(99999999999999999n,1n,2n)); assert.throws(()=>reserve(0n,17000000n,60000000n));
});
test('completed batches never get sent again; failed and pending stop forward progress',()=>{
 const j=fresh(); assert.equal(next(j,28000000000000000000000n).batch,0);
 j.entries.push({kind:'send',batch:0,settled:true,success:true}); assert.equal(next(j,26600000000000000000000n).batch,1);
 j.entries.push({kind:'send',batch:1,settled:false}); assert.throws(()=>next(j,0n));
 j.entries[1].settled=true;j.entries[1].success=false;assert.throws(()=>next(j,0n));
});
test('allowance is limited to remainder and revoked when done',()=>{
 const j=fresh();assert.deepEqual(next(j,0n),{kind:'approve',amount:'28000000000000000000000'});
 assert.deepEqual(next(j,1n),{kind:'reset',amount:'0'});
 j.entries=Array.from({length:20},(_,batch)=>({kind:'send',batch,settled:true,success:true}));
 assert.equal(next(j,0n),null);assert.equal(next(j,1n).kind,'reset');
});
test('tampered campaign and transaction recipients cannot be resumed',()=>{
 const j=fresh();assert.doesNotThrow(()=>validate(j));j.account='0x0000000000000000000000000000000000000001';assert.throws(()=>validate(j));
 const q=fresh();q.entries=[{kind:'send',batch:0,transaction:{to:q.account,data:'0x',value:'0',nonce:5,gas:'1000000',gasPrice:'60000000'}}];assert.throws(()=>validate(q));
});
test('remote checkpoint must acknowledge signed hash before broadcasting',async()=>{
 const j=fresh(); const e={}; let sent=0;
 await assert.rejects(()=>persistThenBroadcast({journal:j,entry:e,raw:'0x1234',save:async()=>{throw Error('storage down')},broadcast:async()=>{sent++}}));assert.equal(sent,0);
 let persisted;await persistThenBroadcast({journal:j,entry:e,raw:'0x1234',save:async()=>{persisted=e.hash},broadcast:async raw=>{assert.equal(raw,'0x1234');assert.ok(persisted);sent++;return persisted}});assert.equal(sent,1);
 await assert.rejects(()=>persistThenBroadcast({journal:j,entry:e,raw:'0xabcd',save:async()=>{},broadcast:async()=>{sent++}}));assert.equal(sent,1);
});
test('full offline campaign exhausts exact approval after 20 rounds, and repeat run is a no-op',()=>{
 const j=fresh();let allowance=0n,spent=31134577509141262n,transferred=0n;const seen=new Set();
 for(let i=0;i<21;i++){
  const e=next(j,allowance);assert.ok(e);const c=callFor(e);reserve(spent,1000000n,60000000n);spent+=60000000000000n;
  if(e.kind==='approve')allowance=BigInt(e.amount);
  else{assert.equal(e.batch,i-1);for(const a of plan()[e.batch]){assert.ok(!seen.has(a));seen.add(a)}allowance-=1400000000000000000000n;transferred+=1400000000000000000000n;}
  j.entries.push({...e,transaction:{...c,value:'0',nonce:5+i,chainId:56,type:'legacy',gas:'1000000',gasPrice:'60000000'},hash:keccak256(c.data),settled:true,success:true});validate(j);
 }
 assert.equal(seen.size,4000);assert.equal(transferred,28000000000000000000000n);assert.equal(allowance,0n);assert.equal(next(j,allowance),null);assert.equal(spent,32394577509141262n);
 const wire=JSON.stringify(compact(j));assert.ok(wire.length<20000);const restored=hydrate(JSON.parse(wire));validate(restored);assert.equal(next(restored,0n),null);assert.deepEqual(restored,j);
});
function deliveryLogs(){
 const logs=plan()[0].map(recipient=>({address:DISTRIBUTOR,topics:encodeEventTopics({abi:artifact.abi,eventName:'Delivered',args:{sender:ACCOUNT,token:TOKEN,batchId:batchId(0)}}),data:encodeAbiParameters([{type:'address'},{type:'uint256'},{type:'uint256'}],[recipient,7000000000000000000n,7000000000000000000n])}));
 logs.push({address:DISTRIBUTOR,topics:encodeEventTopics({abi:artifact.abi,eventName:'BatchCompleted',args:{sender:ACCOUNT,token:TOKEN,batchId:batchId(0)}}),data:encodeAbiParameters([{type:'uint256'},{type:'uint256'}],[200n,1400000000000000000000n])});return logs;
}
test('receipt requires all 200 distinct exact recipients and seven actual tokens each',()=>{
 const logs=deliveryLogs();assert.equal(verifyDelivery({kind:'send',batch:0},logs).length,200);
 const duplicated=structuredClone(logs);duplicated[199]=duplicated[0];assert.throws(()=>verifyDelivery({kind:'send',batch:0},duplicated));
 const taxed=structuredClone(logs);taxed[0].data=encodeAbiParameters([{type:'address'},{type:'uint256'},{type:'uint256'}],[plan()[0][0],7000000000000000000n,6790000000000000000n]);assert.throws(()=>verifyDelivery({kind:'send',batch:0},taxed));
 assert.throws(()=>verifyDelivery({kind:'send',batch:1},logs));
});
test('additional legacy wallet spending cannot fall outside lifetime budget',async()=>{
 for(const unexpected of ['latest','pending']){
  const c={getTransactionCount:async({address,blockTag})=>address.toLowerCase()===ACCOUNT.toLowerCase()?5:blockTag===unexpected?7:6};
  await assert.rejects(()=>nonceCheck([c,c],5,false));
 }
});

// The RPC and signer are the external boundaries. All production run-loop,
// receipt, budget, checkpoint and state-transition code below is real.
function networkFixture(){
 const receipts=new Map(),txs=new Map(),signed=new Map(),completed=new Set();let nonce=5,allowance=0n,balance=30000000000000000000000n,drop=true,broadcasts=0,durable;
 const blockHash='0x'+'1'.repeat(64);
 const receipt=(hash,from,gasUsed,gasPrice,logs=[])=>({transactionHash:hash,from,blockHash,blockNumber:'0x1',status:'0x1',gasUsed:toHex(gasUsed),effectiveGasPrice:toHex(gasPrice),logs,contractAddress:null});
 for(const p of history){
  txs.set(p.hash,{hash:p.hash,from:p.from,chainId:'0x38',blockHash,nonce:toHex(p.nonce),to:p.to||TOKEN,input:p.data||'0x',value:toHex(BigInt(p.valueWei)),gas:'0x1',gasPrice:'0x1'});
  receipts.set(p.hash,{...receipt(p.hash,p.from,BigInt(p.feeWei),1n),status:p.success?'0x1':'0x0'});
 }
 const store=()=>({journal:durable?hydrate(JSON.parse(durable)):fresh(),save:async j=>{validate(j);durable=JSON.stringify(compact(j));}});
 const client={
  getChainId:async()=>56,getCode:async()=>artifact.runtime,getBlockNumber:async()=>100n,getBlock:async()=>({hash:blockHash,number:1n}),
  getBalance:async()=>70000000000000000n,getGasPrice:async()=>50000000n,estimateGas:async()=>100000n,call:async()=>({data:'0x'}),
  getTransactionCount:async({address})=>address.toLowerCase()===ACCOUNT.toLowerCase()?nonce:6,
  readContract:async({functionName,args})=>({decimals:18,balanceOf:balance,allowance,completed:completed.has(args?.[1])})[functionName],
  request:async({method,params})=>{if(method==='eth_getTransactionByHash')return txs.get(params[0])||null;if(method==='eth_getTransactionReceipt')return receipts.get(params[0])||null;throw Error('Unexpected RPC method')},
  waitForTransactionReceipt:async({hash})=>{assert.ok(receipts.has(hash));return receipts.get(hash)},
  sendRawTransaction:async({serializedTransaction:raw})=>{
   const t=signed.get(raw),hash=keccak256(raw);assert.equal(JSON.parse(durable).entries.at(-1).hash,hash);assert.equal(t.nonce,nonce);broadcasts++;
   const decoded=decodeFunctionData({abi:t.to.toLowerCase()===TOKEN.toLowerCase()?erc20:artifact.abi,data:t.data});const logs=[];
   if(decoded.functionName==='approve')allowance=decoded.args[1];
   else{
    const [token,id,recipients,amounts]=decoded.args;assert.equal(token.toLowerCase(),TOKEN.toLowerCase());assert.equal(recipients.length,200);assert.ok(!completed.has(id));
    recipients.forEach((recipient,i)=>{assert.equal(amounts[i],7000000000000000000n);logs.push({address:DISTRIBUTOR,topics:encodeEventTopics({abi:artifact.abi,eventName:'Delivered',args:{sender:ACCOUNT,token:TOKEN,batchId:id}}),data:encodeAbiParameters([{type:'address'},{type:'uint256'},{type:'uint256'}],[recipient,amounts[i],amounts[i]])})});
    logs.push({address:DISTRIBUTOR,topics:encodeEventTopics({abi:artifact.abi,eventName:'BatchCompleted',args:{sender:ACCOUNT,token:TOKEN,batchId:id}}),data:encodeAbiParameters([{type:'uint256'},{type:'uint256'}],[200n,1400000000000000000000n])});
    balance-=1400000000000000000000n;allowance-=1400000000000000000000n;completed.add(id);
   }
   txs.set(hash,{hash,from:ACCOUNT,chainId:'0x38',blockHash,nonce:toHex(t.nonce),to:t.to,input:t.data,value:'0x0',gas:toHex(t.gas),gasPrice:toHex(t.gasPrice)});
   receipts.set(hash,receipt(hash,ACCOUNT,100000n,t.gasPrice,logs));nonce++;
   if(completed.size===1&&drop){drop=false;throw Error('RPC accepted transaction but response was lost')};return hash;
  },
 };
 const account={address:ACCOUNT,signTransaction:async t=>{const raw=toHex(JSON.stringify(t,(_,v)=>typeof v==='bigint'?v.toString():v));signed.set(raw,t);return raw}};
 return {client,store,account,stats:()=>({broadcasts,nonce,balance,allowance,completed:completed.size})};
}
test('actual runner recovers accepted-send response loss, completes20, and cannot replay after restart',async t=>{
 t.mock.method(console,'log',()=>{}); // Suppress simulated hashes: they are not mainnet transactions.
 const f=networkFixture(),args={clients:[f.client,f.client],execute:true,ownedReturnConfirmed:true,accountProvider:async()=>f.account};
 await assert.rejects(()=>run({...args,store:f.store()}),/response was lost/);
 assert.equal(f.stats().completed,1);
 const done=await run({...args,store:f.store()});
 assert.equal(done.entries.filter(e=>e.kind==='send'&&e.received.length===200).length,20);
 assert.deepEqual(f.stats(),{broadcasts:21,nonce:26,balance:2000000000000000000000n,allowance:0n,completed:20});
 assert.equal(BigInt(done.spentWei),CHARGED_BASELINE+126000000000000n);
 assert.equal(BigInt(done.rawSpentWei),RAW_BASELINE+126000000000000n);
 assert.equal(BigInt(done.campaignGasWei),126000000000000n);
 await run({...args,store:f.store(),accountProvider:async()=>f.account});assert.equal(f.stats().broadcasts,21);
 const unapproved=f.store();
 await assert.rejects(()=>run({...args,store:unapproved,execute:false,ownedReturnConfirmed:false,accountProvider:async()=>{throw Error('must not load signer')}}),/确认/);
 assert.equal(unapproved.journal.rawSpentWei,done.rawSpentWei);
 assert.equal(unapproved.journal.spentWei,undefined);
 assert.equal(unapproved.journal.entries.filter(e=>e.kind==='send'&&e.received.length===200).length,20);
 assert.equal(f.stats().broadcasts,21);
});
