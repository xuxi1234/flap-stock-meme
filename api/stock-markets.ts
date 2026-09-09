import stocks from '../src/swap/stock-tokens.json'
import { normalizeMarkets } from '../src/swap/marketData.js'

type Request = { method?: string }
type Response = { setHeader: (key: string, value: string) => void; status: (status: number) => Response; json: (body: unknown) => void }
export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); res.status(405).json({ error: 'GET required' }); return }
  try {
    // Fixed reviewed addresses; no caller-supplied URL, wallet address or contract.
    const addresses = stocks.map(t => t.address)
    const response = await fetch('https://api.dexscreener.com/tokens/v1/bsc/' + addresses.join(','), { signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw new Error('Market provider unavailable')
    const markets = normalizeMarkets(await response.json(), addresses)
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')
    res.status(200).json({ fetchedAt: Date.now(), markets })
  } catch {
    res.setHeader('Cache-Control', 'no-store')
    res.status(503).json({ error: '链上行情暂时不可用，兑换报价仍可独立查询。' })
  }
}
