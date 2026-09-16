import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {validateMetadata,confirmedReceipt,frontendConfig} from '../scripts/deploy.mjs';
test('deployment metadata rejects relative, insecure, placeholder and ambiguous bases',()=>{
 for(const uri of ['/metadata/','http://host/path/','https://example.com/','https://a.test/path','https://user:pass@a.test/','https://a.test/?v=2','ipfs:///'])assert.throws(()=>validateMetadata(uri));
 assert.equal(validateMetadata('ipfs://bafyvalid/'),'ipfs://bafyvalid/');assert.equal(validateMetadata('https://assets.project.org/nft/'),'https://assets.project.org/nft/');
});
test('default deployment reports missing inputs without loading any secret',()=>{
 const env={PATH:process.env.PATH};const r=spawnSync(process.execPath,['scripts/deploy.mjs'],{env,encoding:'utf8'});assert.equal(r.status,0);const report=JSON.parse(r.stdout);assert.equal(report.mode,'check-only');assert.equal(report.ready,false);assert.ok(report.missing.includes('NFT_SIGNER_ADDRESS'));
 const e=spawnSync(process.execPath,['scripts/deploy.mjs','--execute'],{env,encoding:'utf8'});assert.equal(e.status,1);assert.match(e.stderr,/Missing inputs/);
});

test('resume gate blocks spending for shallow recovered and recorded receipts',async()=>{
 const receipt={status:1,blockNumber:100,blockHash:'canonical',contractAddress:'deployed'};
 for(const recorded of [undefined,{...receipt}]){
  let head=100,reads=0,spends=0;
  const provider={getTransactionReceipt:async()=>{reads++;return {...receipt};},getBlockNumber:async()=>head};
  const resume=async()=>{const r=await confirmedReceipt(provider,'tx',recorded);spends++;return r.contractAddress;};
  await assert.rejects(resume(),/needs 3 confirmations/);assert.equal(spends,0);assert.equal(reads,1);
  head=102;assert.equal(await resume(),'deployed');assert.equal(spends,1);assert.equal(reads,3,'confirmed path re-reads canonical receipt');
 }
});
test('resume gate rejects failed, missing and reorganized receipts',async()=>{
 const receipt={status:1,blockNumber:100,blockHash:'canonical'};
 for(const value of [null,{...receipt,status:0}])await assert.rejects(confirmedReceipt({getTransactionReceipt:async()=>value},'tx'),/Missing or failed/);
 await assert.rejects(confirmedReceipt({getTransactionReceipt:async()=>receipt},'tx',{...receipt,blockHash:'old'}),/Noncanonical/);
 let reads=0;await assert.rejects(confirmedReceipt({getBlockNumber:async()=>102,getTransactionReceipt:async()=>++reads===1?receipt:{...receipt,blockHash:'reorg'}},'tx'),/changed during/);
 assert.equal(reads,2);
});
test('frontend handoff contains runtime hashes and stays disabled pending independent review',()=>{
 const input={collection:'0x1111111111111111111111111111111111111111',market:'0x2222222222222222222222222222222222222222',collectionCode:'0x6000',marketCode:'0x6001',assetBase:'https://assets.project.org/nft/'};
 const d=frontendConfig(input);assert.equal(d.enabled,false);assert.equal(d.chainId,56);assert.equal(d.assetBase,input.assetBase);assert.match(d.collectionCodeHash,/^0x[0-9a-f]{64}$/);assert.notEqual(d.collectionCodeHash,d.marketCodeHash);assert.ok(d.reason);
 for(const invalid of [{collectionCode:'0x'},{market:input.collection},{assetBase:'ipfs://bafyvalid/'}])assert.throws(()=>frontendConfig({...input,...invalid}));
});
