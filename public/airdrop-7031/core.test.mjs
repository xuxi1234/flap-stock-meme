import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {ACCOUNT,TOKEN,DISTRIBUTOR,AMOUNT,PLAN_SHA,EVENT,word,addr,validate,group,dataFor,verifyReceipt} from './core.mjs';
const raw=fs.readFileSync(new URL('./plan.json',import.meta.url));
const p=validate(JSON.parse(raw));
test('fixed snapshot hash and 36 batches cover exactly 7031 recipients',()=>{
 assert.equal(createHash('sha256').update(raw).digest('hex'),PLAN_SHA);
 assert.equal(group(p,35).length,31);
 assert.deepEqual(Array.from({length:36},(_,i)=>group(p,i)).flat(),p.addresses);
 assert.equal(7031n*AMOUNT,5468008700000000000000n);
});
test('ABI independently decodes every recipient and amount',()=>{
 for(let i=0;i<36;i++){
  const data=dataFor(p,i);assert.equal(data.slice(0,10),'0x8b46a263');
  const w=data.slice(10).match(/.{64}/g),first=Number(BigInt('0x'+w[2]))/32,second=Number(BigInt('0x'+w[3]))/32,n=group(p,i).length;
  assert.equal(w[0],addr(TOKEN));assert.equal('0x'+w[1],p.batchIds[i]);
  assert.equal(Number(BigInt('0x'+w[first])),n);assert.equal(Number(BigInt('0x'+w[second])),n);
  assert.deepEqual(w.slice(first+1,first+1+n).map(x=>'0x'+x.slice(24)),group(p,i));
  assert.equal(w.length,second+1+n);assert.ok(w.slice(second+1).every(x=>BigInt('0x'+x)===AMOUNT));
 }
});
const block={hash:'0xabc',timestamp:'0x3e8'},head={number:'0x66'};
const receipt=()=>({status:'0x1',from:ACCOUNT,to:DISTRIBUTOR,blockNumber:'0x64',blockHash:block.hash,logs:[{address:DISTRIBUTOR,topics:[EVENT,'0x'+addr(ACCOUNT),p.batchIds[0],'0x'+addr(TOKEN)],data:'0x'+word(200)+word(200n*AMOUNT)}]});
test('verified previous batch unlocks at chain timestamp + 3600',()=>assert.equal(verifyReceipt(p,0,receipt(),head,block),4600));
test('reject failed, foreign, unconfirmed, reorged and mismatched receipts',()=>{
 for(const change of [r=>r.status='0x0',r=>r.from=TOKEN,r=>r.to=TOKEN,r=>r.blockHash='0xdef',r=>r.logs[0].topics[2]=p.batchIds[1],r=>r.logs[0].data='0x'+word(199)+word(200n*AMOUNT)]){const r=receipt();change(r);assert.throws(()=>verifyReceipt(p,0,r,head,block));}
 assert.throws(()=>verifyReceipt(p,0,receipt(),{number:'0x65'},block));
});
test('reject duplicates and wrong recipient count',()=>{const q=structuredClone(p);q.addresses[1]=q.addresses[0];assert.throws(()=>validate(q));assert.throws(()=>validate({...p,addresses:p.addresses.slice(1)}));});
