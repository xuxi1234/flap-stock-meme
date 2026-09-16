import { describe,it,expect,vi } from 'vitest'
import type { PublicClient } from 'viem'
import {splitFee,parseReferrer,referralLink,feeDeployment,verifyFeeDeployment,withPlatformFee,TREASURY} from './fees'
import {TOKENS,WBNB} from './config'
import {assertReview,swapCall,type SwapQuote} from './service'
const a='0x0000000000000000000000000000000000001234' as const
describe('approved fee policy',()=>{
 it('allocates 0.8 percent and the 70:30 split in exact asset units',()=>expect(splitFee(100000n,true)).toEqual({fee:800n,inviter:560n,treasury:240n,net:99200n}))
 it('sends every fee unit to treasury without an inviter',()=>expect(splitFee(100000n,false)).toEqual({fee:800n,inviter:0n,treasury:800n,net:99200n}))
 it('conserves rounding dust and large values',()=>{for(const n of [1n,125n,126n,1000n,10001n,10n**27n+999n]){const s=splitFee(n,true);expect(s.net+s.inviter+s.treasury).toBe(n);expect(s.inviter<=s.fee).toBe(true)}expect(()=>splitFee(-1n,true)).toThrow()})
 it('rejects ambiguous, self and invalid referral links',()=>{expect(parseReferrer(`?ref=${a}`)).toBe(a);expect(parseReferrer(`?p=${a}`)).toBe(a);expect(parseReferrer(`?ref=${a}`,a)).toBeNull();expect(parseReferrer(`?ref=${a}&p=${a}`)).toBeNull();expect(parseReferrer(`?ref=${TREASURY}`)).toBeNull();expect(parseReferrer('?ref=javascript:alert(1)')).toBeNull()})
 it('creates clean invitation links without amounts or unrelated parameters',()=>expect(referralLink('https://app.gupiao.sh',a)).toBe(`https://app.gupiao.sh/?view=swap&ref=${a}`))
 it('does not allow an unverified deployment to request RPC reads or wallet writes',async()=>{const client={getCode:vi.fn()};expect(feeDeployment()).toBeNull();await expect(verifyFeeDeployment(client as unknown as PublicClient)).rejects.toThrow('尚未');expect(client.getCode).not.toHaveBeenCalled()})
 it('deducts fee once and blocks tampered previews or missing deployment',()=>{
  const q:SwapQuote={input:TOKENS[0],output:TOKENS[1],amountIn:10n,amountOut:100000n,path:[WBNB,TOKENS[1].address],expiresAt:Date.now()+30000,block:1n,impactBps:1,wrap:false}
  const net=withPlatformFee(q);expect(net.amountOut).toBe(99200n);expect(withPlatformFee(net)).toBe(net)
  const r={quote:net,minimumOut:98704n,slippageBps:50,account:a};expect(()=>assertReview(r)).not.toThrow();expect(()=>swapCall(r)).toThrow('尚未')
  net.platformFee!.fee=1n;expect(()=>assertReview(r)).toThrow()
  expect(withPlatformFee({...q,wrap:true})).toEqual({...q,wrap:true})
 })
})
