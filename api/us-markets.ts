import { instruments, parseHistory, parseQuoteBatch, providerSymbol, validSymbol } from '../src/markets/data.js'

type Request = { method?: string; query?: Record<string, string | string[] | undefined> }
type Response = { setHeader: (key: string, value: string) => void; status: (status: number) => Response; json: (body: unknown) => void }
async function read(url: string, encoding = 'utf-8') {
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw new Error('Provider unavailable')
  const bytes = await response.arrayBuffer()
  if (bytes.byteLength > 1000000) throw new Error('Response too large')
  return new TextDecoder(encoding).decode(bytes)
}
export default async function handler(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); res.status(405).json({ error: 'GET required' }); return }
  const symbol = req.query?.symbol
  if ((symbol !== undefined && !validSymbol(symbol)) || Object.keys(req.query ?? {}).some(k => k !== 'symbol')) { res.status(400).json({ error: '请输入有效的美股代码。' }); return }
  try {
    let result
    if (typeof symbol === 'string') {
      const url = 'https://web.ifzq.gtimg.cn/appstock/app/usfqkline/get?param=' + encodeURIComponent(providerSymbol(symbol) + ',day,,,180,qfq')
      const history = parseHistory(JSON.parse(await read(url)), symbol)
      if (!history.quote && history.bars.length === 0) throw new Error('No data')
      result = { history }
    } else {
      // Bounded batch of reviewed equities. No arbitrary URL or caller-supplied upstream.
      const symbols = instruments.map(i => i.symbol)
      const quotes = parseQuoteBatch(await read('https://qt.gtimg.cn/q=' + symbols.map(s => 'us' + s.split(':')[1]).join(','), 'gb18030'), symbols)
      if (!quotes.length) throw new Error('No data')
      result = { quotes }
    }
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=60')
    res.status(200).json({ source: '腾讯行情', fetchedAt: Date.now(), ...result })
  } catch {
    res.status(503).json({ error: '美股行情暂时不可用，请重试或打开腾讯行情查看。' })
  }
}
