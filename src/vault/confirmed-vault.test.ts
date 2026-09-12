import { describe, expect, it } from 'vitest'
import type { PublicClient } from 'viem'
import { confirmedVault, readConfirmedVault } from './confirmed-vault'
import { REVENUE } from './protocol'

function rpc(registryVault=confirmedVault.vault,receiver=REVENUE){
  return {getChainId:async()=>56,getBlockNumber:async()=>123n,getBalance:async()=>10n**16n,readContract:async(q:{functionName:string;blockNumber:bigint})=>{
    expect(q.blockNumber).toBe(123n)
    if(q.functionName==='getVault')return {vault:registryVault,vaultFactory:confirmedVault.factory}
    if(q.functionName==='taxToken')return confirmedVault.token
    if(q.functionName==='commissionReceiver')return receiver
    if(q.functionName==='totalReceivedBnb')return 25n*10n**15n
    throw Error('Unexpected call')
  }} as unknown as PublicClient
}
describe('confirmed vault live snapshot',()=>{
  it('checks registry/token relationships and keeps vault funds separate from commission recipient',async()=>{
    const result=await readConfirmedVault(rpc())
    expect(result).toMatchObject({block:123n,balance:10n**16n,totalReceived:25n*10n**15n,recipient:REVENUE,recipientMatches:true})
  })
  it('rejects a registry that points to another vault',async()=>{
    await expect(readConfirmedVault(rpc(REVENUE))).rejects.toThrow()
  })
  it('reports a changed receiver instead of showing the configured address as live',async()=>{
    const result=await readConfirmedVault(rpc(confirmedVault.vault,confirmedVault.token))
    expect(result.recipientMatches).toBe(false)
    expect(result.recipient).toBe(confirmedVault.token)
  })
})
