// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPublicClient, http } from 'viem'
import handler from '../../api/swap-rpc'
import { prepare } from './service'

async function relay(body: unknown) {
  let status = 200, data: unknown
  await handler({method:'POST',body},{setHeader(){},status(n){status=n;return this},json(v){data=v}})
  return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}})
}
beforeEach(()=>{
  // Only replace the external RPC. Keep viem serialization, our HTTP validation,
  // and the transaction preparation path real to catch this boundary failure.
  vi.stubGlobal('fetch',async (_url:unknown,init:RequestInit)=>{
    const body=JSON.parse(String(init.body))
    const respond=(r:{id:number;method:string;params:unknown[]})=>{
      if(!Array.isArray(r.params))return {jsonrpc:'2.0',id:r.id,error:{code:-32602,message:'params must be an array'}}
      const results:Record<string,string>={eth_chainId:'0x38',eth_blockNumber:'0x100',eth_gasPrice:'0x2faf080',eth_getCode:'0x6000',eth_call:'0x',eth_estimateGas:'0x5208',eth_getBalance:'0x16345785d8a0000'}
      return {jsonrpc:'2.0',id:r.id,result:results[r.method]}
    }
    return new Response(JSON.stringify(Array.isArray(body)?body.map(respond):respond(body)),{status:200})
  })
})
afterEach(()=>vi.unstubAllGlobals())
describe('read relay request compatibility',()=>{
  it('prepares a transaction through actual viem HTTP serialization',async()=>{
    const client=createPublicClient({transport:http('https://relay.invalid',{retryCount:0,fetchFn:async(_url,init)=>relay(JSON.parse(String(init?.body)))})})
    const result=await prepare(client,'0x79F8b832DE72e81Ad34fd66EcbbF673613264072','0x90497450f2a706f1951b5bdda52B4E5d16f34C06','0x12345678',0n,'acceptance')
    expect(result.gas).toBe(26250n)
    expect(result.gasPrice).toBe(60000001n)
    expect(result.value).toBe(0n)
  })
  it('accepts omitted no-argument params in mixed read batches',async()=>{
    const response=await relay([{jsonrpc:'2.0',id:1,method:'eth_blockNumber'},{jsonrpc:'2.0',id:2,method:'eth_chainId',params:[]}])
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([{jsonrpc:'2.0',id:1,result:'0x100'},{jsonrpc:'2.0',id:2,result:'0x38'}])
  })
  it.each([
    {jsonrpc:'2.0',id:1,method:'eth_call'},
    {jsonrpc:'2.0',id:1,method:'eth_chainId',params:null},
    {jsonrpc:'2.0',id:1,method:'eth_sendRawTransaction',params:['0x1234']},
  ])('rejects malformed or write requests: $method',async body=>{
    expect((await relay(body)).status).toBe(400)
  })
})
