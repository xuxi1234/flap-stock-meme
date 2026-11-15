import {test} from 'node:test'
import assert from 'node:assert/strict'
import {categories,factories,marketFields,scanLogs} from './core.mjs'
test('classification requires actual state, known factory and effective token risk',()=>{
 const v=[true,{vaultFactory:factories.stocks[0],riskLevel:1}]
 assert.deepEqual(categories({status:1},v,1),['trending','bonding','stocks','fac','innovation'])
 assert.deepEqual(categories({status:4},[false,{}],0),['trending'])
 assert.deepEqual(categories({status:5},[true,{vaultFactory:'0xunknown',riskLevel:0}],0),['trending'])
 for(const [tag,list] of Object.entries(factories))for(const factory of list){assert.match(factory,/^0x[\da-f]{40}$/);assert.ok(categories({status:4},[true,{vaultFactory:factory,riskLevel:0}],0).includes(tag))}
})
test('prices only use exact chain/base/pool and missing values stay unknown',()=>{
 const pair={chainId:'bsc',baseToken:{address:'0xaa'},pairAddress:'0xbb',priceUsd:'1.5',volume:{h24:0}}
 assert.equal(marketFields([pair],'0xaa','0xbb').price,1.5)
 assert.equal(marketFields([pair],'0xaa','0xbb').change4h,null)
 assert.equal(marketFields([pair],'0xaa','0xbb').volume24h,0)
 assert.deepEqual(marketFields([pair],'0xaa','0xcc'),{})
})
test('adaptive log splitting covers inclusive range and propagates persistent errors',async()=>{
 const c={getLogs:async({fromBlock,toBlock})=>{if(toBlock-fromBlock>10n)throw Error();return Array.from({length:Number(toBlock-fromBlock+1n)},(_,i)=>Number(fromBlock)+i)}}
 assert.deepEqual(await scanLogs(c,'a',{},0n,31n),Array.from({length:32},(_,i)=>i))
 await assert.rejects(scanLogs({getLogs:async()=>{throw Error()}},'a',{},0n,1n))
})

import * as market from './core.mjs'
const token='0x'+'a'.repeat(40),pool='0x'+'b'.repeat(40)
const row=(extra={})=>({listed:true,coin:{address:token},pool,...extra})
const pair=(extra={})=>({chainId:'bsc',baseToken:{address:token},pairAddress:pool,priceUsd:'0.04863',volume:{h24:0},...extra})
test('verified-pool fallback fills only graduated missing prices using original pool',async()=>{
 assert.equal(typeof market.fillPoolFallback,'function')
 const rows=[row(),row({listed:false}),row({price:2})],urls=[]
 const d=await market.fillPoolFallback(rows,{fetcher:async url=>{urls.push(url);return new Response(JSON.stringify({pairs:[pair()]}))},pause:async()=>{}})
 assert.deepEqual(urls,[`https://api.dexscreener.com/latest/dex/pairs/bsc/${pool}`])
 assert.equal(rows[0].price,0.04863);assert.equal(rows[0].volume24h,0);assert.equal(rows[1].price,undefined);assert.equal(rows[2].price,2);assert.equal(d.filled,1)
})
test('market fields never coerce missing, malformed, negative USD values into prices',()=>{
 for(const priceUsd of ['', ' ', false, [], {}, '-1','Infinity','0x10'])assert.equal(marketFields([pair({priceUsd})],token,pool).price,null)
 assert.equal(marketFields([pair({priceUsd:'0'})],token,pool).price,0)
 assert.equal(marketFields([pair({priceChange:{m5:-3},liquidity:{usd:-1}})],token,pool).change5m,-3)
 assert.equal(marketFields([pair({liquidity:{usd:-1}})],token,pool).liquidity,null)
})
test('fallback rejects another chain/token/pool, bad response and no-pair without inventing zeros',async()=>{
 assert.equal(typeof market.fillPoolFallback,'function')
 for(const fixture of [{pairs:[pair({chainId:'ethereum'})]},{pairs:[pair({baseToken:{address:pool}})]},{pairs:[pair({pairAddress:token})]},{pairs:null},{pair:pair()},{pairs:[pair({priceUsd:false})]}]){
  const rows=[row()];await market.fillPoolFallback(rows,{fetcher:async()=>new Response(JSON.stringify(fixture)),pause:async()=>{}});assert.equal(rows[0].price,undefined)
 }
})
test('fallback bounds request count, spaces sequential requests and stops on rate limit',async()=>{
 assert.equal(typeof market.fillPoolFallback,'function')
 let active=0,peak=0,count=0;const waits=[]
 const rows=Array.from({length:35},(_,i)=>row({pool:'0x'+(i+1).toString(16).padStart(40,'0')}))
 const d=await market.fillPoolFallback(rows,{fetcher:async()=>{count++;active++;peak=Math.max(peak,active);await Promise.resolve();active--;return new Response('{"pairs":null}')},pause:async ms=>waits.push(ms)})
 assert.equal(count,30);assert.equal(peak,1);assert.equal(waits.length,29);assert.ok(waits.every(ms=>ms>=250));assert.equal(d.deferred,5)
 count=0;await market.fillPoolFallback(rows,{fetcher:async()=>{count++;return new Response('',{status:429})},pause:async()=>{}});assert.equal(count,1)
})
test('fallback refuses invalid pool addresses and preserves fields after transport failure',async()=>{
 assert.equal(typeof market.fillPoolFallback,'function')
 const rows=[row({pool:'0x'+'0'.repeat(40)}),row({pool:'https://evil.test'}),row({price:null,liquidity:null})];let count=0
 await market.fillPoolFallback(rows,{fetcher:async()=>{count++;throw Error('network')},pause:async()=>{}});assert.equal(count,1);assert.equal(rows[2].price,null);assert.equal(rows[2].liquidity,null)
})
test('fallback bounds body size, tolerates invalid JSON and preserves known metrics',async()=>{
 for(const body of ['x'.repeat(256001),'not json']){
  const rows=[row()];const d=await market.fillPoolFallback(rows,{fetcher:async()=>new Response(body),pause:async()=>{}});assert.equal(rows[0].price,undefined);assert.equal(d.failed,1)
 }
 const rows=[row({liquidity:42,volume24h:17})];await market.fillPoolFallback(rows,{fetcher:async()=>new Response(JSON.stringify({pairs:[pair()]})),pause:async()=>{}});assert.equal(rows[0].liquidity,42);assert.equal(rows[0].volume24h,17)
})
test('fallback respects cycle time budget and forbids redirects',async()=>{
 let time=0,count=0;const rows=[row(),row(),row()]
 const d=await market.fillPoolFallback(rows,{now:()=>time,pause:async ms=>{time+=ms},fetcher:async(url,options)=>{count++;assert.equal(options.redirect,'error');assert.ok(options.signal);time+=15000;return new Response('{"pairs":null}')}})
 assert.equal(count,1);assert.equal(d.deferred,2)
})
