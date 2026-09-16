import { afterEach, describe, expect, it, vi } from 'vitest'
import { zeroAddress, type Address, type PublicClient, type WalletClient } from 'viem'
import { BUTTERFLY, FACTORY, ROUTER, TOKENS, WBNB } from './config'
import { approveLiquidity, assertLiquidityReview, buildLiquidityReview, executeLiquidity, liquidityApprovals, liquidityCall, readPool, validatePair, type PoolPosition } from './liquidity'
const account='0x0000000000000000000000000000000000001234' as Address,other='0x0000000000000000000000000000000000005678' as Address
const pair='0x1111111111111111111111111111111111111111' as Address,hash=`0x${'1'.repeat(64)}` as `0x${string}`
const unit=10n**18n
const pool=():PoolPosition=>({pair,reserveA:100n*unit,reserveB:20000n*unit,supply:1000n*unit,owned:10n*unit,block:100n,fetchedAt:Date.now()})
const review=()=>buildLiquidityReview('add',TOKENS[0],TOKENS[1],account,pool(),unit,200n*unit,0n,50)
function mocks(){
  const wallet={getChainId:vi.fn().mockResolvedValue(56),getAddresses:vi.fn().mockResolvedValue([account]),writeContract:vi.fn().mockResolvedValue(hash)}
  const client={getChainId:vi.fn().mockResolvedValue(56),getBlockNumber:vi.fn().mockResolvedValue(100n),getBalance:vi.fn().mockResolvedValue(100n*unit),getGasPrice:vi.fn().mockResolvedValue(1000000000n),estimateGas:vi.fn().mockResolvedValue(200000n),simulateContract:vi.fn(async request=>({request})),readContract:vi.fn(async({functionName}: {functionName:string})=>{switch(functionName){case 'factory':return FACTORY;case 'WETH':return WBNB;case 'getPair':return pair;case 'token0':return TOKENS[1].address;case 'token1':return WBNB;case 'getReserves':return [20000n*unit,100n*unit,0];case 'totalSupply':return 1000n*unit;default:return 100000n*unit}})}
  return {client,wallet,c:client as unknown as PublicClient,w:wallet as unknown as WalletClient}
}
afterEach(()=>vi.useRealTimers())
describe('liquidity arithmetic and calls',()=>{
  it('normalizes native BNB and WBNB to the same pool asset',()=>expect(()=>validatePair(TOKENS[0],TOKENS[6])).toThrow('不同'))
  it('rejects unknown, taxed and uninitialized pools for writes',()=>{
    expect(()=>buildLiquidityReview('add',TOKENS[0],BUTTERFLY,account,pool(),unit,unit,0n,50)).toThrow('含税')
    expect(()=>buildLiquidityReview('add',TOKENS[0],{...TOKENS[1],custom:true},account,pool(),unit,unit,0n,50)).toThrow('未收录')
    expect(()=>buildLiquidityReview('add',TOKENS[0],TOKENS[1],account,{...pool(),pair:zeroAddress},unit,unit,0n,50)).toThrow('已有池')
  })
  it('uses the limiting side and conserves unspent amounts',()=>{
    const r=buildLiquidityReview('add',TOKENS[0],TOKENS[1],account,pool(),2n*unit,200n*unit,0n,50)
    expect(r.amountA).toBe(unit);expect(r.amountB).toBe(200n*unit);expect(r.liquidity).toBe(10n*unit);expect(r.minA).toBe(995n*unit/1000n)
  })
  it('retains integer rounding when the second asset limits liquidity',()=>{
    const p={...pool(),reserveA:7000n,reserveB:3000n,supply:10000n}
    const r=buildLiquidityReview('add',TOKENS[0],TOKENS[1],account,p,1000n,101n,0n,50)
    expect(r.amountA).toBe(235n);expect(r.amountB).toBe(101n);expect(()=>assertLiquidityReview(r)).not.toThrow()
  })
  it('removes exactly the selected LP portion and computes both minimums',()=>{
    const r=buildLiquidityReview('remove',TOKENS[0],TOKENS[1],account,pool(),0n,0n,5n*unit,100)
    expect(r.amountA).toBe(unit/2n);expect(r.amountB).toBe(100n*unit);expect(r.minB).toBe(99n*unit)
    expect(liquidityApprovals(r)).toEqual([{address:pair,amount:5n*unit,symbol:'LP'}])
    expect(()=>buildLiquidityReview('remove',TOKENS[0],TOKENS[1],account,pool(),0n,0n,11n*unit,50)).toThrow('余额')
  })
  it('binds native value, token minimum, recipient and deadline to either pair order',()=>{
    const r=review(),call=liquidityCall(r,123n)
    expect(call).toMatchObject({address:ROUTER,functionName:'addLiquidityETH',value:unit,args:[TOKENS[1].address,200n*unit,199n*unit,995n*unit/1000n,account,123n]})
    const reverse=buildLiquidityReview('add',TOKENS[1],TOKENS[0],account,{...pool(),reserveA:20000n*unit,reserveB:100n*unit},200n*unit,unit,0n,50)
    expect(liquidityCall(reverse,123n)).toEqual(call)
  })
  it('uses nonpayable methods for token pairs and LP removal',()=>{
    const add=buildLiquidityReview('add',TOKENS[6],TOKENS[1],account,pool(),unit,200n*unit,0n,50)
    expect(liquidityCall(add).functionName).toBe('addLiquidity');expect(liquidityCall(add).value).toBeUndefined()
    const remove=buildLiquidityReview('remove',TOKENS[6],TOKENS[1],account,pool(),0n,0n,unit,50)
    expect(liquidityCall(remove).functionName).toBe('removeLiquidity');expect(liquidityCall(remove).value).toBeUndefined()
  })
  it('rejects expired reviews and changed minimum amounts',()=>{
    const r=review();expect(()=>assertLiquidityReview({...r,minA:0n})).toThrow('参数')
    vi.useFakeTimers();vi.setSystemTime(r.expiresAt);expect(()=>assertLiquidityReview(r)).toThrow('过期')
  })
  it('reads reserves with the actual token ordering and one block',async()=>{
    const {c,client}=mocks();const p=await readPool(c,TOKENS[0],TOKENS[1],null)
    expect(p).toMatchObject({reserveA:100n*unit,reserveB:20000n*unit,owned:null,block:100n})
    expect(client.readContract).toHaveBeenCalledWith(expect.objectContaining({functionName:'getReserves',blockNumber:100n}))
  })
})
describe('wallet and submission boundaries',()=>{
  it('never writes when simulation fails',async()=>{const {c,w,client,wallet}=mocks();client.simulateContract.mockRejectedValue(new Error('simulation reverted'));await expect(executeLiquidity(c,w,review())).rejects.toThrow('reverted');expect(wallet.writeContract).not.toHaveBeenCalled()})
  it('checks the account again after simulation',async()=>{const {c,w,client,wallet}=mocks();client.simulateContract.mockImplementation(async request=>{wallet.getAddresses.mockResolvedValue([other]);return {request}});await expect(executeLiquidity(c,w,review())).rejects.toThrow('账户');expect(wallet.writeContract).not.toHaveBeenCalled()})
  it('rejects an incorrect router factory',async()=>{const {c,w,client,wallet}=mocks();client.readContract.mockResolvedValue(other);await expect(executeLiquidity(c,w,review())).rejects.toThrow('路由');expect(wallet.writeContract).not.toHaveBeenCalled()})
  it('does not write after a slow simulation expires the review',async()=>{vi.useFakeTimers();const {c,w,client,wallet}=mocks();const r=review();client.simulateContract.mockImplementation(async request=>{vi.setSystemTime(r.expiresAt);return {request}});await expect(executeLiquidity(c,w,r)).rejects.toThrow('过期');expect(wallet.writeContract).not.toHaveBeenCalled()})
  it('reserves native gas in addition to the exact input',async()=>{const {c,w,client,wallet}=mocks();client.getBalance.mockResolvedValue(unit);await expect(executeLiquidity(c,w,review())).rejects.toThrow('网络费');expect(wallet.writeContract).not.toHaveBeenCalled()})
  it('submits only the reviewed native input to the canonical router',async()=>{const {c,w,wallet}=mocks();await executeLiquidity(c,w,review());expect(wallet.writeContract).toHaveBeenCalledWith(expect.objectContaining({address:ROUTER,value:unit,account,chain:expect.objectContaining({id:56})}))})
  it.each([0n,1n])('uses exact or zero-first approval from allowance %s',async allowance=>{const {c,w,client,wallet}=mocks();const original=client.readContract.getMockImplementation()!;client.readContract.mockImplementation(async args=>args.functionName==='allowance'?allowance:original(args));await approveLiquidity(c,w,review());expect(wallet.writeContract).toHaveBeenCalledWith(expect.objectContaining({address:TOKENS[1].address,functionName:'approve',args:[ROUTER,allowance===0n?200n*unit:0n]}))})
})
