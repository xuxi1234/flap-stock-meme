import { describe, expect, it } from 'vitest'
import { erc20Abi, parseEther } from 'viem'
import { FACTORY, ROUTER, TOKENS, WBNB } from './config'
import { getQuote, makeSwapClient } from './service'

// Opt-in, read-only mainnet smoke check. No keys, wallet, approvals or broadcasts.
describe.skipIf(!import.meta.env.VITE_SWAP_READONLY_SMOKE)('BSC read-only integration', () => {
  const client = makeSwapClient()
  it('confirms deployed router identity and common token metadata', async () => {
    const abi = [{ type: 'function', name: 'factory', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' }, { type: 'function', name: 'WETH', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' }] as const
    expect((await client.readContract({ address: ROUTER, abi, functionName: 'factory' })).toLowerCase()).toBe(FACTORY.toLowerCase())
    expect((await client.readContract({ address: ROUTER, abi, functionName: 'WETH' })).toLowerCase()).toBe(WBNB.toLowerCase())
    for (const token of TOKENS.filter(t => !t.native)) {
      expect(await client.readContract({ address: token.address, abi: erc20Abi, functionName: 'decimals' })).toBe(token.decimals)
    }
  }, 90000)
  it.each([[0, 1], [1, 2], [2, 0], [0, 6]])('gets a real quote %s → %s', async (a, b) => {
    const quote = await getQuote(client, TOKENS[a], TOKENS[b], parseEther('0.01'))
    console.info(JSON.stringify({ pair: `${TOKENS[a].symbol}/${TOKENS[b].symbol}`, amountOut: quote.amountOut.toString(), block: quote.block.toString(), impactBps: quote.impactBps, path: quote.path }))
    expect(quote.amountOut).toBeGreaterThan(0n); expect(quote.block).toBeGreaterThan(0n)
  }, 90000)
})
