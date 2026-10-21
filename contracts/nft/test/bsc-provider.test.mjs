import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCreation} from '../scripts/bsc-provider.mjs';
test('empty creation destination normalized without masking invalid addresses',()=>{
 for(const method of ['eth_getTransactionByHash','eth_getTransactionReceipt']){
  assert.deepEqual(normalizeCreation(method,{to:'',hash:'same'}),{to:null,hash:'same'});
  assert.deepEqual(normalizeCreation(method,{to:'invalid'}),{to:'invalid'});
  assert.equal(normalizeCreation(method,null),null);
 }
 assert.deepEqual(normalizeCreation('other',{to:''}),{to:''});
});
