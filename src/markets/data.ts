// US equities only. BSC token prices are deliberately a separate data model.
export const stocks = [
  { symbol: 'NASDAQ:AAPL', name: '苹果 Apple' },
  { symbol: 'NASDAQ:NVDA', name: '英伟达 NVIDIA' },
  { symbol: 'NASDAQ:MSFT', name: '微软 Microsoft' },
  { symbol: 'NASDAQ:TSLA', name: '特斯拉 Tesla' },
  { symbol: 'NASDAQ:AMZN', name: '亚马逊 Amazon' },
  { symbol: 'NASDAQ:META', name: 'Meta' },
  { symbol: 'NASDAQ:GOOGL', name: '谷歌 Alphabet' },
  { symbol: 'NASDAQ:AMD', name: 'AMD' },
  { symbol: 'NYSE:BABA', name: '阿里巴巴 Alibaba' },
  { symbol: 'NYSE:BRK.B', name: '伯克希尔 Berkshire Hathaway' },
]
export const indexEtfs = [
  { symbol: 'AMEX:SPY', name: 'SPY · 标普500 ETF' },
  { symbol: 'NASDAQ:QQQ', name: 'QQQ · 纳斯达克100 ETF' },
  { symbol: 'AMEX:DIA', name: 'DIA · 道琼斯 ETF' },
  { symbol: 'AMEX:IWM', name: 'IWM · 罗素2000 ETF' },
]
export const instruments = [...stocks, ...indexEtfs]
export const validSymbol = (s: unknown): s is string => typeof s === 'string' && /^(NASDAQ|NYSE|AMEX):[A-Z0-9.\-]{1,16}$/.test(s)
export function providerSymbol(symbol: string) {
  if (!validSymbol(symbol)) return null
  const [exchange, ticker] = symbol.split(':')
  return 'us' + ticker + ({ NASDAQ: '.OQ', NYSE: '.N', AMEX: '.AM' }[exchange] ?? '')
}
export const sourceLink = (symbol: string) => 'https://gu.qq.com/' + (providerSymbol(symbol) ?? 'usAAPL.OQ')
export type EquityQuote = {
  symbol: string; price: number; previousClose: number | null; open: number | null;
  high: number | null; low: number | null; volume: number | null;
  change: number | null; changePercent: number | null; asOf: string; currency: 'USD';
}
export type DailyBar = { date: string; open: number; close: number; high: number; low: number; volume: number | null }
export type EquityHistory = { symbol: string; quote: EquityQuote | null; bars: DailyBar[]; adjustment: 'qfq' | 'none'; marketState: string | null }
export type EquityResponse = { source: '腾讯行情'; fetchedAt: number; quotes?: EquityQuote[]; history?: EquityHistory }
const number = (v: unknown): number | null => {
  if (typeof v !== 'string' && typeof v !== 'number') return null
  if (String(v).trim() === '') return null
  const n = Number(v); return Number.isFinite(n) ? n : null
}
const positive = (v: unknown) => { const n = number(v); return n !== null && n > 0 ? n : null }
const nonnegative = (v: unknown) => { const n = number(v); return n !== null && n >= 0 ? n : null }
function validDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const ms = Date.parse(date + 'T00:00:00Z')
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === date
}
export function parseQuote(value: unknown, symbol: string): EquityQuote | null {
  if (!Array.isArray(value) || 'us' + value[2] !== providerSymbol(symbol) || value[35] !== 'USD') return null
  const price = positive(value[3]), asOf = value[30]
  if (price === null || typeof asOf !== 'string' || !/^\d{4}-\d{2}-\d{2} (?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(asOf) || !validDate(asOf.slice(0, 10))) return null
  return { symbol, price, previousClose: positive(value[4]), open: positive(value[5]), volume: nonnegative(value[6]), asOf, change: number(value[31]), changePercent: number(value[32]), high: positive(value[33]), low: positive(value[34]), currency: 'USD' }
}
export function parseQuoteBatch(text: string, symbols: string[]): EquityQuote[] {
  // The provider's response is JavaScript assignment syntax. Never execute it.
  const rows = [...text.matchAll(/v_us[A-Z0-9.\-]+="([^"\r\n]*)";/g)].map(m => m[1].split('~'))
  return symbols.flatMap(symbol => {
    const q = rows.map(row => parseQuote(row, symbol)).find(Boolean)
    return q ? [q] : []
  })
}
export function parseHistory(value: unknown, symbol: string): EquityHistory {
  const body = value as { code?: unknown; data?: Record<string, { qfqday?: unknown; day?: unknown; qt?: Record<string, unknown> }> } | null
  const code = providerSymbol(symbol)
  const data = code && body?.code === 0 ? body.data?.[code] : null
  if (!data || !code) throw new Error('No equity history')
  const adjustment = Array.isArray(data.qfqday) ? 'qfq' : 'none'
  const rows = adjustment === 'qfq' ? data.qfqday : data.day
  const barsByDate = new Map<string, DailyBar>()
  if (Array.isArray(rows)) for (const row of rows) {
    if (!Array.isArray(row) || typeof row[0] !== 'string' || !validDate(row[0])) continue
    const [open, close, high, low] = [row[1], row[2], row[3], row[4]].map(positive)
    if (open === null || close === null || high === null || low === null || low > Math.min(open, close) || high < Math.max(open, close) || low > high) continue
    barsByDate.set(row[0], { date: row[0], open, close, high, low, volume: nonnegative(row[5]) })
  }
  let bars = [...barsByDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-180)
  // Malformed aliases can return one legacy point plus today's point. Do not draw a misleading bridge.
  for (let i = bars.length - 1; i > 0; i--) if (Date.parse(bars[i].date) - Date.parse(bars[i - 1].date) > 35 * 86400000) { bars = bars.slice(i); break }
  const quote = parseQuote(data.qt?.[code] ?? data.qt?.['us' + symbol.split(':')[1]], symbol)
  const market = data.qt?.market
  const state = Array.isArray(market) && typeof market[0] === 'string' ? market[0].match(/(?:^|\|)US_(?:open|close)_([^|]+)/)?.[1] : null
  return { symbol, quote, bars, adjustment, marketState: state && state.length < 20 ? state : null }
}
