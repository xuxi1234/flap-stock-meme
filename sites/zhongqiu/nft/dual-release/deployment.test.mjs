import test from 'node:test';import assert from 'node:assert/strict';
import {normalized} from './deploy.mjs';
test('runtime check masks immutable constructor values but preserves executable bytes',()=>{
 const a={evm:{deployedBytecode:{immutableReferences:{'1':[{start:2,length:2}]}}}};
 assert.equal(normalized('0xaabb1234ccdd',a),'aabb0000ccdd');
 assert.equal(normalized('aabbabcdccdd',a),'aabb0000ccdd');
 assert.notEqual(normalized('0xaabc1234ccdd',a),'aabb0000ccdd');
});
