import { afterEach, expect, it, vi } from 'vitest'
import handler from '../../api/us-markets'
const response = () => { const res = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn() }; res.status.mockReturnValue(res); return res }
afterEach(() => vi.unstubAllGlobals())
it('bounds the source and rejects arbitrary URLs, multiple symbols, arrays and writes', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
  for (const query of [{ symbol: 'https://example.com' }, { symbol: 'NASDAQ:AAPL,usTSLA' }, { symbol: ['NASDAQ:AAPL'] }, { url: 'http://localhost/' }]) {
    const res = response(); await handler({ method: 'GET', query }, res); expect(res.status).toHaveBeenCalledWith(400)
  }
  const res = response(); await handler({ method: 'POST' }, res); expect(res.status).toHaveBeenCalledWith(405)
  expect(fetch).not.toHaveBeenCalled()
})
it('returns unavailable without caching errors or inventing quotes', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')))
  const res = response(); await handler({ method: 'GET', query: { symbol: 'NASDAQ:AAPL' } }, res)
  expect(res.status).toHaveBeenCalledWith(503)
  expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store')
  expect(res.json.mock.calls[0][0]).not.toHaveProperty('history')
})
it('returns validated history with its symbol, adjustment and source', async () => {
  const raw = JSON.stringify({ code: 0, data: { 'usAAPL.OQ': { qfqday: [['2026-09-09', '315.49', '315.34', '319.15', '309.90', '65639962']] } } })
  const bytes = new TextEncoder().encode(raw)
  const fetch = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => bytes.buffer }); vi.stubGlobal('fetch', fetch)
  const res = response(); await handler({ method: 'GET', query: { symbol: 'NASDAQ:AAPL' } }, res)
  expect(fetch.mock.calls[0][0]).toBe('https://web.ifzq.gtimg.cn/appstock/app/usfqkline/get?param=usAAPL.OQ%2Cday%2C%2C%2C180%2Cqfq')
  expect(res.status).toHaveBeenCalledWith(200)
  expect(res.json.mock.calls[0][0]).toMatchObject({ source: '腾讯行情', history: { symbol: 'NASDAQ:AAPL', adjustment: 'qfq', bars: [{ close: 315.34 }] } })
})
