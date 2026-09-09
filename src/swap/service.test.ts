import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseEther, type Address, type PublicClient, type WalletClient } from 'viem'
import { ROUTER, TOKENS, WBNB, homeHref, swapHref } from './config'
import { approveExact, assertReview, candidatePaths, executeSwap, getQuote, minimumReceived, parseAmount, swapCall, type SwapReview } from './service'
const account = '0x0000000000000000000000000000000000001234' as Address
const other = '0x0000000000000000000000000000000000005678' as Address
const hash = ('0x' + '1'.repeat(64)) as `0x${string}`
function review(): SwapReview { return { account, slippageBps: 50, minimumOut: 995n, quote: { input: TOKENS[0], output: TOKENS[1], amountIn: 100n, amountOut: 1000n, expiresAt: Date.now() + 30_000, path: [WBNB, TOKENS[1].address], impactBps: 10, block: 1n, wrap: false } } }
function mocks() {
  const wallet = { getChainId: vi.fn().mockResolvedValue(56), getAddresses: vi.fn().mockResolvedValue([account]), switchChain: vi.fn(), writeContract: vi.fn().mockResolvedValue(hash) }
  const client = { getChainId: vi.fn().mockResolvedValue(56), getBalance: vi.fn().mockResolvedValue(parseEther('2')), readContract: vi.fn().mockResolvedValue(parseEther('2')), simulateContract: vi.fn().mockResolvedValue({ request: {} }), estimateGas: vi.fn().mockResolvedValue(100000n), getGasPrice: vi.fn().mockResolvedValue(1000000000n) }
  return { wallet, client, w: wallet as unknown as WalletClient, c: client as unknown as PublicClient }
}
afterEach(() => vi.useRealTimers())
describe('exact integer amounts and routes', () => {
  it('preserves values larger than JS safe integers and token decimals', () => { expect(parseAmount('123456789.123456789123456789', 18)).toBe(123456789123456789123456789n); expect(parseAmount('.1', 6)).toBe(100000n) })
  it.each(['-1', '0', '1e18', 'Infinity', 'NaN', '1,000', '0.1234567'])('rejects unsafe amount %s', value => expect(() => parseAmount(value, 6)).toThrow())
  it('rejects slippage outside 0.1–5 percent and rounds min out down', () => { expect(minimumReceived(101n, 50)).toBe(100n); expect(() => minimumReceived(1n, 0)).toThrow(); expect(() => minimumReceived(1n, 501)).toThrow() })
  it('builds only bounded paths without loops', () => { for (const path of candidatePaths(TOKENS[0], TOKENS[1])) { expect(new Set(path.map(a => a.toLowerCase())).size).toBe(path.length); expect(path.length).toBeLessThanOrEqual(4) } })
  it('opens each production swap subdomain while keeping preview navigation local', () => {
    for (const host of ['gupiao.sh', 'www.gupiao.sh']) expect(swapHref(host)).toBe('https://app.gupiao.sh/')
    for (const host of ['hudiegupiao.com', 'www.hudiegupiao.com']) expect(swapHref(host)).toBe('https://app.hudiegupiao.com/')
    expect(swapHref('example.vercel.app')).toBe('/?view=swap')
    for (const host of ['app.gupiao.sh', 'app.hudiegupiao.com']) expect(swapHref(host)).toBe('/')
    expect(homeHref('app.gupiao.sh')).toBe('https://gupiao.sh/')
  })
})
describe('transaction invariants', () => {
  it('uses the reviewed recipient, minimum output and canonical router', () => { const r = review(); const call = swapCall(r); expect(call.address).toBe(ROUTER); expect(call.functionName).toBe('swapExactETHForTokensSupportingFeeOnTransferTokens'); expect(call.args?.[0]).toBe(r.minimumOut); expect(call.args?.[2]).toBe(account); expect(call.value).toBe(100n) })
  it('uses token sell / token-to-token entrypoints with zero native value', () => { const r = review(); r.quote.input = TOKENS[1]; r.quote.output = TOKENS[0]; expect(swapCall(r).functionName).toBe('swapExactTokensForETHSupportingFeeOnTransferTokens'); expect(swapCall(r).value).toBeUndefined(); r.quote.output = TOKENS[2]; expect(swapCall(r).functionName).toBe('swapExactTokensForTokensSupportingFeeOnTransferTokens') })
  it('wraps and unwraps only at WBNB', () => { const r = review(); r.quote.wrap = true; r.quote.output = TOKENS[6]; expect(swapCall(r).address).toBe(WBNB); expect(swapCall(r).functionName).toBe('deposit'); r.quote.input = TOKENS[6]; r.quote.output = TOKENS[0]; expect(swapCall(r).functionName).toBe('withdraw') })
  it('rejects expired quotes, altered minOut and high impact', () => { const r = review(); expect(() => assertReview(r, r.quote.expiresAt)).toThrow(); r.minimumOut = 0n; expect(() => assertReview(r)).toThrow(); r.minimumOut = 995n; r.quote.impactBps = 1000; expect(() => assertReview(r)).toThrow() })
  it('does not prompt or write on an expired quote', async () => { const { c, w, wallet } = mocks(); const r = review(); r.quote.expiresAt = 0; await expect(executeSwap(c, w, r)).rejects.toThrow('过期'); expect(wallet.getAddresses).not.toHaveBeenCalled(); expect(wallet.writeContract).not.toHaveBeenCalled() })
  it('rechecks expiry after a slow network switch', async () => { vi.useFakeTimers(); const { c, w, wallet } = mocks(); wallet.getChainId.mockResolvedValueOnce(1); const r = review(); wallet.switchChain.mockImplementation(async () => vi.setSystemTime(r.quote.expiresAt + 1)); await expect(executeSwap(c, w, r)).rejects.toThrow('过期'); expect(wallet.writeContract).not.toHaveBeenCalled() })
  it('rejects a wallet that stays on the wrong network', async () => { const { c, w, wallet } = mocks(); wallet.getChainId.mockResolvedValue(1); await expect(executeSwap(c, w, review())).rejects.toThrow('BNB'); expect(wallet.writeContract).not.toHaveBeenCalled() })
  it('rejects an account change during simulation', async () => { const { c, w, wallet, client } = mocks(); client.simulateContract.mockImplementation(async () => { wallet.getAddresses.mockResolvedValue([other]); return { request: {} } }); await expect(executeSwap(c, w, review())).rejects.toThrow('账户'); expect(wallet.writeContract).not.toHaveBeenCalled() })
  it('prevents writing when simulation fails or gas reserve is insufficient', async () => {
    const { c, w, wallet, client } = mocks(); client.simulateContract.mockRejectedValueOnce(new Error('revert')); await expect(executeSwap(c, w, review())).rejects.toThrow('revert'); expect(wallet.writeContract).not.toHaveBeenCalled(); client.getBalance.mockResolvedValue(100n); await expect(executeSwap(c, w, review())).rejects.toThrow('网络费'); expect(wallet.writeContract).not.toHaveBeenCalled()
  })
  it('sends a simulated trade with the intended native value', async () => { const { c, w, wallet, client } = mocks(); expect(await executeSwap(c, w, review())).toBe(hash); expect(client.simulateContract).toHaveBeenCalled(); expect(wallet.writeContract).toHaveBeenCalledWith(expect.objectContaining({ address: ROUTER, value: 100n, account, chain: expect.objectContaining({ id: 56 }) })) })
  it('requires approval before a token swap', async () => { const { c, w, wallet, client } = mocks(); const r = review(); r.quote.input = TOKENS[1]; client.readContract.mockImplementation(async ({ functionName }) => functionName === 'allowance' ? 0n : parseEther('2')); await expect(executeSwap(c, w, r)).rejects.toThrow('授权'); expect(wallet.writeContract).not.toHaveBeenCalled() })
  it('approves only the reviewed quantity to Pancake, without swapping', async () => { const { c, w, wallet, client } = mocks(); const r = review(); r.quote.input = TOKENS[1]; client.readContract.mockResolvedValue(0n); client.simulateContract.mockImplementation(async request => ({ request })); await approveExact(c, w, r); expect(wallet.writeContract).toHaveBeenCalledTimes(1); expect(wallet.writeContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'approve', address: TOKENS[1].address, args: [ROUTER, 100n] })) })
  it('resets nonzero insufficient allowance without granting unlimited approval', async () => { const { c, w, wallet, client } = mocks(); const r = review(); r.quote.input = TOKENS[1]; client.readContract.mockResolvedValue(50n); client.simulateContract.mockImplementation(async request => ({ request })); await approveExact(c, w, r); expect(wallet.writeContract).toHaveBeenCalledWith(expect.objectContaining({ args: [ROUTER, 0n] })) })
})
describe('quote behavior', () => {
  it('selects highest successful output even if one pool is unavailable', async () => {
    const client = { getChainId: async () => 56, getBlockNumber: async () => 100n, readContract: vi.fn(async ({ functionName, args }) => {
      if (functionName === 'getAmountsOut') { if (args[1].length === 2) throw new Error('no pair'); return [100n, args[1][1] === TOKENS[3].address ? 200n : 150n] }
      if (functionName === 'getPair') return other
      return [1000000n, 1000000n, 0]
    }) }
    const q = await getQuote(client as unknown as PublicClient, TOKENS[2], TOKENS[1], 100n)
    expect(q.amountOut).toBe(200n); expect(q.path[1]).toBe(TOKENS[3].address); expect(q.block).toBe(100n)
    expect(client.readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'getAmountsOut', blockNumber: 100n }))
  })
  it('returns an error rather than inventing a price when all pools fail', async () => { const client = { getChainId: async () => 56, getBlockNumber: async () => 1n, readContract: async () => { throw new Error('offline') } }; await expect(getQuote(client as unknown as PublicClient, TOKENS[0], TOKENS[1], 100n)).rejects.toThrow('路径') })
})

describe('three-pool routes', () => {
  it('finds a bridge between two assets when shorter routes fail and bounds requests', async () => {
    const input = TOKENS[7], output = TOKENS[8]
    const paths = candidatePaths(input, output)
    expect(paths).toHaveLength(10)
    expect(new Set(paths.map(p => p.join('-'))).size).toBe(10)
    for (const path of paths) expect(new Set(path).size).toBe(path.length)
    const client = { getChainId: async () => 56, getBlockNumber: async () => 100n, readContract: vi.fn(async ({ functionName, args }) => {
      if (functionName === 'getAmountsOut') { if (args[1].length !== 4) throw new Error('no route'); return [100n, 100n, 100n, 90n] }
      if (functionName === 'getPair') return other
      return [1000000n, 1000000n, 0]
    }) }
    const quote = await getQuote(client as unknown as PublicClient, input, output, 100n)
    expect(quote.path).toHaveLength(4); expect(quote.amountOut).toBe(90n)
    expect(quote.checkedPaths).toBe(10); expect(quote.alternatives).toHaveLength(6)
  })
})
