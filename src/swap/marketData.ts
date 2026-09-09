// DEX Screener market data is informational only. It never supplies transaction calldata.
export type TokenMarket = { address: string; pairAddress: string; priceUsd: number; change24h: number | null; volume24h: number | null; liquidityUsd: number; dex: string; protocol: string; quoteSymbol: string }
export type MarketSnapshot = { fetchedAt: number; markets: Record<string, TokenMarket> }
const positive = (value: unknown) => (typeof value === 'number' || typeof value === 'string') && value !== '' && Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null
const nonnegative = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
const quoteAssets: Record<string, string> = {
  '0x55d398326f99059ff775485246999027b3197955': 'USDT',
  '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': 'USDC',
  '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c': 'WBNB',
}
export function normalizeMarkets(value: unknown, addresses: string[]): Record<string, TokenMarket> {
  const known = new Set(addresses.map(a => a.toLowerCase()))
  const markets: Record<string, TokenMarket> = {}
  if (!Array.isArray(value)) throw new Error('Invalid market response')
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue
    const p = raw as Record<string, any>
    const address = typeof p.baseToken?.address === 'string' ? p.baseToken.address.toLowerCase() : ''
    const quote = typeof p.quoteToken?.address === 'string' ? quoteAssets[p.quoteToken.address.toLowerCase()] : undefined
    const price = positive(p.priceUsd), liquidity = positive(p.liquidity?.usd)
    if (p.chainId !== 'bsc' || p.dexId !== 'pancakeswap' || !known.has(address) || !quote || !price || !liquidity || !/^0x[\da-fA-F]{40}$/.test(p.pairAddress ?? '')) continue
    // Highest-liquidity supported-quote pool from returned results, not total market liquidity.
    if (markets[address] && markets[address].liquidityUsd >= liquidity) continue
    const labels = Array.isArray(p.labels) ? p.labels : []
    markets[address] = { address, pairAddress: p.pairAddress.toLowerCase(), priceUsd: price, liquidityUsd: liquidity,
      change24h: typeof p.priceChange?.h24 === 'number' && Number.isFinite(p.priceChange.h24) ? p.priceChange.h24 : null,
      volume24h: nonnegative(p.volume?.h24), dex: 'PancakeSwap', quoteSymbol: quote,
      protocol: labels.includes('v3') ? 'V3' : labels.includes('v2') ? 'V2' : '其他池型' }
  }
  return markets
}
export function usd(value: number | null | undefined, compact = false) {
  return value == null || !Number.isFinite(value) ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: compact ? 'compact' : 'standard', maximumFractionDigits: value < 1 && value > 0 ? 4 : 2 }).format(value)
}
export function percent(value: number | null | undefined) { return value == null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(2)}%` }
