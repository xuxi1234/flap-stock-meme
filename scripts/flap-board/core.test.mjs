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
