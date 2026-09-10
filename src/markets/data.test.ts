import { describe, expect, it } from 'vitest'
import { parseQuote, parseHistory, providerSymbol, parseQuoteBatch } from './data'

function fields(code = 'AAPL.OQ') {
  const f = Array(71).fill('')
  Object.assign(f, { 1: '苹果', 2: code, 3: '315.34', 4: '316.22', 5: '315.49', 6: '65639962', 30: '2026-09-09 16:00:01', 31: '-0.88', 32: '-0.28', 33: '319.15', 34: '309.90', 35: 'USD' })
  return f
}
describe('US equity data identity and values', () => {
  it('maps exchange-specific identifiers including class B shares', () => {
    expect(providerSymbol('NASDAQ:AAPL')).toBe('usAAPL.OQ')
    expect(providerSymbol('NYSE:BRK.B')).toBe('usBRK.B.N')
    expect(providerSymbol('AMEX:SPY')).toBe('usSPY.AM')
    expect(providerSymbol('https://example.com')).toBeNull()
    expect(providerSymbol('NASDAQ:AAPL,usTSLA')).toBeNull()
  })
  it('preserves source time and distinguishes missing values from zero', () => {
    const q = parseQuote(fields(), 'NASDAQ:AAPL')!
    expect(q).toMatchObject({ symbol: 'NASDAQ:AAPL', price: 315.34, previousClose: 316.22, change: -0.88, changePercent: -0.28, asOf: '2026-09-09 16:00:01', currency: 'USD', volume: 65639962 })
    const f = fields(); f[6] = ''; f[32] = '0'
    expect(parseQuote(f, 'NASDAQ:AAPL')).toMatchObject({ volume: null, changePercent: 0 })
  })
  it('rejects the wrong equity, currency, nonfinite price and missing timestamp', () => {
    expect(parseQuote(fields('TSLA.OQ'), 'NASDAQ:AAPL')).toBeNull()
    for (const [index, value] of [[3, 'NaN'], [3, '0'], [30, ''], [30, '2026-02-31 16:00:00'], [35, 'CNY']] as const) {
      const f = fields(); f[index] = value; expect(parseQuote(f, 'NASDAQ:AAPL')).toBeNull()
    }
  })
  it('parses quote text as data without evaluating scripts', () => {
    const text = 'v_usAAPL="' + fields().join('~') + '";\nglobalThis.alert("bad")'
    expect(parseQuoteBatch(text, ['NASDAQ:AAPL', 'NASDAQ:TSLA'])).toHaveLength(1)
  })
})
describe('historical daily chart', () => {
  const payload = (rows: unknown[]) => ({ code: 0, data: { 'usAAPL.OQ': { qfqday: rows, qt: { 'usAAPL.OQ': fields(), market: ['2026-09-10 15:00:16|US_close_未开盘|'] } } } })
  it('maps provider open/close/high/low correctly, sorts and deduplicates', () => {
    const result = parseHistory(payload([
      ['2026-09-09', '315.49', '315.34', '319.15', '309.90', '65639962'],
      ['2026-09-08', '317.10', '316.22', '320.70', '314.90', '35477090'],
      ['2026-09-09', '315.49', '315.34', '319.15', '309.90', '65639962'],
    ]), 'NASDAQ:AAPL')
    expect(result.bars).toHaveLength(2)
    expect(result.bars[1]).toMatchObject({ date: '2026-09-09', open: 315.49, close: 315.34, high: 319.15, low: 309.90 })
    expect(result.marketState).toBe('未开盘')
    expect(result.adjustment).toBe('qfq')
  })
  it('rejects invalid OHLC rows and never joins years of missing data into a line', () => {
    const result = parseHistory(payload([
      ['2011-06-02', '346', '346', '347', '344', '1'],
      ['2026-09-08', '317.10', '316.22', '310', '314.90', '1'],
      ['2026-09-09', '315.49', '315.34', '319.15', '309.90', '1'],
    ]), 'NASDAQ:AAPL')
    expect(result.bars).toHaveLength(1)
    expect(result.bars[0].date).toBe('2026-09-09')
  })
  it('does not show another symbol or an upstream error as a valid response', () => {
    expect(() => parseHistory(payload([]), 'NASDAQ:TSLA')).toThrow()
    expect(() => parseHistory({ code: -1 }, 'NASDAQ:AAPL')).toThrow()
  })
})
