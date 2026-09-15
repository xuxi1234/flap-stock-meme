import test from 'node:test';
import assert from 'node:assert/strict';
import { candidates, selectTop, mergeRecipients, scanRanges } from './core.mjs';
const a=n=>'0x'+n.toString(16).padStart(40,'0');
test('Transfer candidates include previous and current owners, never zero',()=>{
 assert.deepEqual(candidates([{topics:['topic','0x'+a(2).slice(2).padStart(64,'0'),'0x'+a(3).slice(2).padStart(64,'0')]},{topics:['topic','0x'+'0'.repeat(64),'0x'+a(2).slice(2).padStart(64,'0')]}]),[a(2),a(3)]);
});
test('ranking uses exact integers and address ties; excludes zero balance',()=>{
 assert.deepEqual(selectTop([{address:a(3),balance:'9007199254740993'},{address:a(2),balance:'9007199254740993'},{address:a(1),balance:'9007199254740992'},{address:a(4),balance:'0'}],2).map(x=>x.address),[a(2),a(3)]);
});
test('filter happens after top selection, preserves provenance and excludes sender',()=>{
 const top=selectTop([{address:a(1),balance:'100'},{address:a(2),balance:'90'},{address:a(3),balance:'80'}],2);
 const result=mergeRecipients([{token:a(8),top},{token:a(9),top:[{address:a(2),balance:'4'},{address:a(7),balance:'3'}]}],{[a(1)]:'0x6000',[a(2)]:'0x',[a(7)]:'0x'},a(7));
 assert.deepEqual(result.recipients,[a(2)]);
 assert.equal(result.sources[a(2)].length,2);
 assert.equal(result.excluded.length,2);
});
test('range split covers every block exactly once after provider limit',async()=>{
 const accepted=[];
 const logs=await scanRanges(async(from,to)=>{if(to-from>1)throw Object.assign(new Error('range'),{range:true});accepted.push([from,to]);return Array.from({length:to-from+1},(_,i)=>({block:from+i}));},10,15);
 assert.deepEqual(logs.map(x=>x.block),[10,11,12,13,14,15]);assert.equal(accepted.length,4);
});
test('single-block failure never yields an incomplete successful scan',async()=>{
 await assert.rejects(scanRanges(async()=>{throw Object.assign(new Error('bad'),{range:true});},1,1),/bad/);
});
