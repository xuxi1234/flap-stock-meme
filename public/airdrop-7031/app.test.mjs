import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ACCOUNT,AMOUNT} from './core.mjs';
test('wallet UI never sends on connect/refresh; explicit click sends one batch and records pending hash',async()=>{
 const elements=new Map();globalThis.document={getElementById:id=>{if(!elements.has(id))elements.set(id,{disabled:false,checked:false,value:'',textContent:''});return elements.get(id);}};
 const saved=new Map();globalThis.localStorage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)};
 const requests=[];let correct=true;
 const provider={on(){},request:async({method,params})=>{
  requests.push({method,params});
  if(method==='eth_requestAccounts'||method==='eth_accounts')return [correct?ACCOUNT:'0x'+'1'.repeat(40)];
  if(method==='eth_chainId')return '0x38';
  if(method==='eth_getCode')return '0x1234';
  if(method==='eth_getBlockByNumber')return {number:'0x100',timestamp:'0x1000'};
  if(method==='eth_getTransactionCount')return '0x1';
  if(method==='eth_estimateGas')return '0x100000';
  if(method==='eth_sendTransaction')return '0x'+'a'.repeat(64);
  if(method==='eth_call'){
   const data=params[0].data;
   if(data.startsWith('0xfa1386ef'))return '0x0';
   if(data==='0x313ce567')return '0x12';
   return '0x'+(7031n*AMOUNT).toString(16);
  }
  throw Error('Unexpected method '+method);
 }};
 globalThis.window={ethereum:provider};
 Object.defineProperty(globalThis,'navigator',{value:{locks:{request:async(k,opts,fn)=>fn({})}},configurable:true});
 globalThis.setInterval=()=>0;
 globalThis.fetch=async url=>({ok:true,text:async()=> '0x1234',arrayBuffer:async()=>{const b=fs.readFileSync(new URL('./plan.json',import.meta.url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}});
 await import('./app.mjs');const el=id=>elements.get(id);
 await el('connect').onclick();assert.equal(el('send').disabled,true);
 assert.equal(requests.filter(x=>x.method==='eth_sendTransaction').length,0);
 el('ack').checked=true;el('ack').onchange();assert.equal(el('send').disabled,false);
 correct=false;await el('send').onclick();assert.equal(requests.filter(x=>x.method==='eth_sendTransaction').length,0);
 correct=true;await el('refresh').onclick();await el('send').onclick();
 const writes=requests.filter(x=>x.method==='eth_sendTransaction');assert.equal(writes.length,1);assert.equal(writes[0].params[0].from,ACCOUNT);
 assert.equal(writes[0].params[0].data.slice(0,10),'0x8b46a263');
 const journal=JSON.parse([...saved.values()][0]);assert.equal(journal.pending.batch,0);assert.equal(journal.pending.hash,'0x'+'a'.repeat(64));assert.equal(el('send').disabled,true);
});
