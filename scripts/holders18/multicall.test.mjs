import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../mint-acceptance/package.json',import.meta.url));
const {decodeFunctionData,encodeFunctionResult,multicall3Abi}=require('viem');
import {readBalances,MULTICALL} from './multicall.mjs';
const token='0x'+'a'.repeat(40),addresses=Array.from({length:100},(_,i)=>'0x'+(i+10).toString(16).padStart(40,'0'));
test('one readonly aggregate call returns every exact balance in the original order',async()=>{
 let calls=0;
 const result=await readBalances(addresses,async(method,[call,tag])=>{
  calls++;assert.equal(method,'eth_call');assert.equal(call.to,MULTICALL);assert.equal(tag,'0x123');
  const d=decodeFunctionData({abi:multicall3Abi,data:call.data});assert.equal(d.functionName,'aggregate3');
  assert.equal(d.args[0].length,100);d.args[0].forEach((c,i)=>{assert.equal(c.target.toLowerCase(),token);assert.equal(c.allowFailure,false);assert.equal(c.callData,'0x70a08231'+addresses[i].slice(2).padStart(64,'0'));});
  return encodeFunctionResult({abi:multicall3Abi,functionName:'aggregate3',result:addresses.map((_,i)=>({success:true,returnData:'0x'+BigInt(i+1).toString(16).padStart(64,'0')}))});
 },token,'0x123');
 assert.equal(calls,1);assert.deepEqual(result,addresses.map((_,i)=>String(i+1)));
});
test('a missing or failed inner balance prevents accepting a partial batch',async()=>{
 for(const result of [[],[{success:false,returnData:'0x'}],[{success:true,returnData:'0x01'}]])await assert.rejects(readBalances([addresses[0]],async()=>encodeFunctionResult({abi:multicall3Abi,functionName:'aggregate3',result}),token,'0x123'));
});
