import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {Interface} from 'ethers';
import {HOSTING_PROPOSAL,verifyPublicAssets,ALLOWED_SIGNER,TOTAL_CAP,INITIAL_FUND,CONFIRMATION,SUBSCRIPTION_ABI,validateLaunchInputs,bootstrapStep,bootstrapSpent,deploymentAllowance,subscriptionIdFromReceipt} from '../scripts/launch.mjs';
const target='0xd691f04bc0C9a24Edb78af9E005Cf85768F694C9';
const gasPrice=50000000n;
const valid={NFT_SIGNER_ADDRESS:ALLOWED_SIGNER,NFT_LAUNCH_MAX_SPEND_BNB:'0.02',NFT_VRF_INITIAL_FUND_BNB:'0.01',NFT_METADATA_BASE:HOSTING_PROPOSAL.metadataBase,NFT_ASSET_BASE:HOSTING_PROPOSAL.assetBase};
function harness(){
 const state={sends:0,head:102,nonce:0,uncertain:false,pending:false,transactions:new Map(),receipts:new Map(),saves:[]};
 const journal={steps:{}};
 const provider={estimateGas:async()=>100000n,getBlockNumber:async()=>state.head,getTransactionCount:async(_address,tag)=>state.nonce+(state.pending&&tag==='pending'?1:0),getTransactionReceipt:async hash=>state.receipts.get(hash)||null,getTransaction:async hash=>state.transactions.get(hash)||null};
 const signer={sendTransaction:async request=>{
  state.sends++;const hash=`tx${state.sends}`;state.nonce++;
  state.transactions.set(hash,{...request,from:ALLOWED_SIGNER,chainId:56n,value:BigInt(request.value||0)});
  const receipt={hash,status:1,blockNumber:100,blockHash:'canonical',gasUsed:80000n,gasPrice,logs:[],toJSON(){return {hash:this.hash,status:this.status,blockNumber:this.blockNumber,blockHash:this.blockHash,logs:this.logs,gasUsed:this.gasUsed.toString(),gasPrice:this.gasPrice.toString()};}};
  state.receipts.set(hash,receipt);if(state.uncertain)throw Error('broadcast result lost');return {hash,wait:async()=>receipt};
 }};
 const run=(label,request,cap=TOTAL_CAP)=>bootstrapStep({provider,signer,signerAddress:ALLOWED_SIGNER,journal,label,request,gasLimitBound:500000n,gasPrice,cap,save:()=>state.saves.push(JSON.stringify(journal))});
 return {state,journal,run};
}
test('launch proposal requires exact payer, funding, cap and execution confirmation',()=>{
 Object.defineProperty(valid,'NFT_DEPLOY_PRIVATE_KEY',{get(){throw Error('must not read key');}});
 assert.equal(validateLaunchInputs(valid).signer,ALLOWED_SIGNER);
 for(const patch of [{NFT_SIGNER_ADDRESS:'0x1111111111111111111111111111111111111111'},{NFT_LAUNCH_MAX_SPEND_BNB:'0.021'},{NFT_VRF_INITIAL_FUND_BNB:'0.011'}])assert.throws(()=>validateLaunchInputs({...valid,...patch}));
 assert.throws(()=>validateLaunchInputs(valid,true),/confirmation required/);assert.equal(validateLaunchInputs({...valid,NFT_LAUNCH_CONFIRM:CONFIRMATION},true).cap,TOTAL_CAP);
 const result=spawnSync(process.execPath,['scripts/launch.mjs'],{env:{PATH:process.env.PATH},encoding:'utf8'});assert.equal(result.status,0);assert.equal(JSON.parse(result.stdout).mode,'check-only');
});
test('combined budget subtracts actual funding and bootstrap gas once across resume',async()=>{
 const h=harness(),create={to:target,data:'0x01'},fund={to:target,data:'0x02',value:INITIAL_FUND};
 await h.run('create',create);await h.run('fund',fund);
 const actual=INITIAL_FUND+2n*80000n*gasPrice;assert.equal(bootstrapSpent(h.journal),actual);assert.equal(deploymentAllowance(TOTAL_CAP,actual),TOTAL_CAP-actual);
 await h.run('create',create);await h.run('fund',fund);assert.equal(h.state.sends,2,'resume must not create or fund twice');assert.equal(bootstrapSpent(h.journal),actual);assert.equal(deploymentAllowance(TOTAL_CAP,actual)+actual,TOTAL_CAP);
 assert.throws(()=>deploymentAllowance(TOTAL_CAP,TOTAL_CAP),/exhausted/);assert.throws(()=>deploymentAllowance(TOTAL_CAP,TOTAL_CAP+1n),/exhausted/);
});
test('ambiguous broadcast saves immutable intent and refuses duplicate creation',async()=>{
 const h=harness(),request={to:target,data:'0x01'};h.state.uncertain=true;
 await assert.rejects(h.run('create',request),/broadcast result lost/);assert.equal(h.state.sends,1);assert.ok(h.journal.steps.create.intent);assert.equal(h.journal.steps.create.hash,undefined);
 await assert.rejects(h.run('create',request),/Unresolved create broadcast intent/);assert.equal(h.state.sends,1);
 h.journal.steps.create.hash='tx1';await h.run('create',request);assert.equal(h.state.sends,1);
 await assert.rejects(h.run('create',{...request,value:1n}),/Immutable bootstrap intent mismatch/);
});
test('recovered bootstrap receipt cannot advance until three confirmations',async()=>{
 const h=harness(),request={to:target,data:'0x01'};h.state.head=100;
 await assert.rejects(h.run('create',request),/3 confirmations/);assert.equal(h.state.sends,1);assert.equal(h.journal.steps.create.actualCostWei,undefined);
 await assert.rejects(h.run('create',request),/3 confirmations/);assert.equal(h.state.sends,1);
 h.state.head=102;await h.run('create',request);assert.equal(h.state.sends,1);assert.equal(bootstrapSpent(h.journal),80000n*gasPrice);
 h.state.receipts.get('tx1').blockHash='changed';await assert.rejects(h.run('create',request),/Noncanonical/);
});
test('funding cannot exceed cumulative cap or ignore pending signer transactions',async()=>{
 const h=harness();await h.run('create',{to:target,data:'0x01'});
 await assert.rejects(h.run('fund',{to:target,data:'0x02',value:INITIAL_FUND},INITIAL_FUND),/exceed cumulative/);assert.equal(h.state.sends,1);assert.equal(h.journal.steps.fund,undefined);
 h.state.pending=true;await assert.rejects(h.run('fund',{to:target,data:'0x02',value:INITIAL_FUND}),/pending transactions/);assert.equal(h.state.sends,1);
});
test('recovery rejects a different transaction even with a canonical receipt',async()=>{
 const h=harness(),request={to:target,data:'0x01'};await h.run('create',request);h.state.transactions.get('tx1').value=1n;
 await assert.rejects(h.run('create',request),/does not match immutable intent/);assert.equal(h.state.sends,1);
});
test('subscription ID requires one coordinator event with expected owner',()=>{
 const iface=new Interface(SUBSCRIPTION_ABI),log={address:target,...iface.encodeEventLog(iface.getEvent('SubscriptionCreated'),[123n,ALLOWED_SIGNER])};
 assert.equal(subscriptionIdFromReceipt({logs:[log]},target,iface,ALLOWED_SIGNER),123n);
 assert.throws(()=>subscriptionIdFromReceipt({logs:[log,log]},target,iface,ALLOWED_SIGNER),/exactly one/);
 assert.throws(()=>subscriptionIdFromReceipt({logs:[log]},target,iface,'0x1111111111111111111111111111111111111111'),/exactly one/);
 assert.equal(iface.getFunction('fundSubscriptionWithNative').stateMutability,'payable');
});

function publicFixture(){
 const bytes=Buffer.from([255,216,255,217]),hash=createHash('sha256').update(bytes).digest('hex');
 const proposal={...HOSTING_PROPOSAL,samples:Object.fromEntries(Object.entries(HOSTING_PROPOSAL.samples).map(([id,v])=>[id,{...v,imageHash:hash}]))};
 const routes=new Map(),base=proposal.metadataBase,assetBase=proposal.assetBase;
 routes.set(`${assetBase}manifest.json`,{mime:'application/json',body:JSON.stringify({...proposal,supply:7777,uniqueArtworkHashes:7777,artFormat:'JPEG'})});
 routes.set(`${base}collection.json`,{mime:'application/json',body:JSON.stringify({name:'Butterfly collection',seller_fee_basis_points:0,image:`${assetBase}art/7777.jpg`})});
 for(const [id,sample] of Object.entries(proposal.samples)){
  routes.set(`${base}${id}.json`,{mime:'application/json',body:JSON.stringify({name:sample.name,image:`${assetBase}art/${id}.jpg`,properties:{edition:Number(id),artwork_sha256:sample.artworkHash,image_sha256:sample.imageHash}})});
  routes.set(`${assetBase}art/${id}.jpg`,{mime:'image/jpeg',body:bytes});
 }
 const seen=[];
 const fetcher=async(url,options)=>{seen.push(url);assert.equal(options.redirect,'error');assert.ok(options.signal);const route=routes.get(url);return new Response(route?.body||'unavailable',{status:route?.status||200,headers:{'content-type':route?.mime||'text/html'}});};
 return {routes,seen,args:{base,assetBase,proposal,fetcher}};
}
test('pre-funding hosting check validates pinned manifest, exact token URIs and sample JPEG hashes',async()=>{
 const f=publicFixture(),result=await verifyPublicAssets(f.args);assert.equal(result.samples.length,2);assert.ok(f.seen.includes(`${f.args.base}7777.json`));assert.equal(result.collectionHash,HOSTING_PROPOSAL.collectionHash);
});
test('hosting check rejects authentication HTML, stale manifest, foreign images and corrupt JPEG',async()=>{
 for(const kind of ['html','manifest','foreign','edition','image']){
  const f=publicFixture(),metaURL=`${f.args.base}1.json`,imageURL=`${f.args.assetBase}art/1.jpg`;
  if(kind==='html')f.routes.set(metaURL,{mime:'text/html',body:'<html>Sign in</html>'});
  if(kind==='manifest'){const url=`${f.args.assetBase}manifest.json`,r=f.routes.get(url);r.body=JSON.stringify({...JSON.parse(r.body),collectionHash:'wrong'});}
  if(kind==='foreign'||kind==='edition'){const r=f.routes.get(metaURL),m=JSON.parse(r.body);if(kind==='foreign')m.image='https://other.example/1.jpg';else m.properties.edition=2;r.body=JSON.stringify(m);}
  if(kind==='image')f.routes.get(imageURL).body=Buffer.from([255,216,0,255,217]);
  await assert.rejects(verifyPublicAssets(f.args));
 }
 const f=publicFixture();await assert.rejects(verifyPublicAssets({...f.args,fetcher:async()=>{throw Error('timed out');}}),/timed out/);
});
