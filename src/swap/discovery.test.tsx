import { fireEvent, render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AssetExplorer } from './AssetExplorer'
import { MAG7_SYMBOLS, STOCK_TOKENS, TOKENS, selectedPair, sharePairUrl, tokenKey } from './config'
import { normalizeMarkets } from './marketData'
import { useFavorites } from './useDiscovery'
import handler from '../../api/stock-markets'

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
const token = STOCK_TOKENS[0]
const pool = { chainId: 'bsc', dexId: 'pancakeswap', pairAddress: '0x1111111111111111111111111111111111111111', baseToken: { address: token.address }, quoteToken: { address: TOKENS[1].address }, priceUsd: '300.25', priceChange: { h24: 0 }, liquidity: { usd: 5000 }, volume: { h24: 0 }, labels: ['v3'] }
describe('reference market data boundaries', () => {
  it('binds data to chain plus contract and a known quote asset', () => {
    for (const wrong of [{ ...pool, chainId: 'ethereum' }, { ...pool, baseToken: { address: TOKENS[1].address } }, { ...pool, quoteToken: { address: '0x2222222222222222222222222222222222222222', symbol: 'USDT' } }, { ...pool, dexId: 'other' }]) expect(normalizeMarkets([wrong], [token.address])).toEqual({})
  })
  it('uses one highest-liquidity returned pool without summing or inventing metrics', () => {
    const data = normalizeMarkets([{ ...pool, liquidity: { usd: 1000 } }, pool], [token.address])[token.address]
    expect(data).toMatchObject({ priceUsd: 300.25, liquidityUsd: 5000, volume24h: 0, change24h: 0, protocol: 'V3' })
    expect(normalizeMarkets([{ ...pool, priceChange: null, volume: null }], [token.address])[token.address]).toMatchObject({ change24h: null, volume24h: null })
  })
  it('rejects invalid prices and untrusted pool addresses', () => {
    for (const price of ['Infinity', '-2', 'NaN', '', null]) expect(normalizeMarkets([{ ...pool, priceUsd: price }], [token.address])).toEqual({})
    expect(normalizeMarkets([{ ...pool, pairAddress: 'javascript:alert(1)' }], [token.address])).toEqual({})
  })
  it('relays only the reviewed list and fails honestly on upstream errors', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false }); vi.stubGlobal('fetch', fetch)
    const res = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn() }; res.status.mockReturnValue(res)
    await handler({ method: 'GET' }, res)
    expect(fetch.mock.calls[0][0]).toBe('https://api.dexscreener.com/tokens/v1/bsc/' + STOCK_TOKENS.map(t => t.address).join(','))
    expect(res.status).toHaveBeenCalledWith(503)
    expect(res.json.mock.calls[0][0]).not.toHaveProperty('markets')
    await handler({ method: 'POST' }, res)
    expect(res.status).toHaveBeenCalledWith(405); expect(fetch).toHaveBeenCalledTimes(1)
  })
})
describe('asset discovery', () => {
  const props = { onSelect: vi.fn(), favorites: [], onFavorite: vi.fn(), snapshot: null, loading: false, error: false, onRefresh: vi.fn(), now: Date.now(), storageError: false }
  it('filters the seven, searches Chinese names, and selects exact contracts', () => {
    render(<AssetExplorer {...props} />)
    expect(screen.getAllByRole('article')).toHaveLength(MAG7_SYMBOLS.length)
    fireEvent.change(screen.getByLabelText('搜索资产目录'), { target: { value: '微软' } })
    expect(screen.getAllByRole('article')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: '选择资产 ↗' }))
    expect(props.onSelect).toHaveBeenCalledWith(STOCK_TOKENS.find(t => t.stockSymbol === 'MSFT'))
    fireEvent.change(screen.getByLabelText('搜索资产目录'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /^ETF$/ }))
    expect(screen.getAllByRole('article')).toHaveLength(2)
  })
  it('retains favorites after remount and supports removal', () => {
    function Harness() { const { favorites, toggle } = useFavorites(); return <button onClick={() => toggle(token.address)}>{favorites.length}</button> }
    const view = render(<Harness />); fireEvent.click(screen.getByRole('button')); expect(screen.getByRole('button')).toHaveTextContent('1'); view.unmount()
    render(<Harness />); expect(screen.getByRole('button')).toHaveTextContent('1'); fireEvent.click(screen.getByRole('button')); expect(screen.getByRole('button')).toHaveTextContent('0')
  })
  it('exports only asset selection, without passing user query or wallet data', () => {
    const url = sharePairUrl('https://example.com', TOKENS[1], token)!
    const parsed = new URL(url)
    expect([...parsed.searchParams.keys()]).toEqual(['view', 'inputCurrency', 'outputCurrency'])
    expect(selectedPair(parsed.search)).toEqual({ input: TOKENS[1], output: token })
    expect(selectedPair('?inputCurrency=evil&outputCurrency=0x0000000000000000000000000000000000000001')).toEqual({ input: TOKENS[0], output: TOKENS[1] })
    const duplicate = selectedPair('?inputCurrency=BNB&outputCurrency=BNB')
    expect(tokenKey(duplicate.input)).not.toBe(tokenKey(duplicate.output))
    expect(sharePairUrl('https://example.com', TOKENS[0], { ...token, address: '0x0000000000000000000000000000000000000001', custom: true })).toBeNull()
  })
})
