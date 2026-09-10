import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { NativeChart } from './NativeMarkets'
import { MarketDashboard } from '../components/MarketDashboard'
import type { EquityResponse } from './data'
const data = (symbol: string, price = 315.34): EquityResponse => ({ source: '腾讯行情', fetchedAt: Date.now(), history: { symbol, adjustment: 'qfq', marketState: '未开盘', quote: { symbol, price, previousClose: 316.22, open: 315.49, high: 319.15, low: 309.90, volume: 65639962, change: -0.88, changePercent: -0.28, asOf: '2026-09-09 16:00:01', currency: 'USD' }, bars: [{ date: '2026-09-08', open: 317.10, close: 316.22, high: 320.70, low: 314.90, volume: 35477090 }, { date: '2026-09-09', open: 315.49, close: 315.34, high: 319.15, low: 309.90, volume: 65639962 }] } })
const ok = (payload: EquityResponse) => ({ ok: true, json: async () => payload })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })
it('shows real-source times, dollar quote and an accessible chart with daily inspection', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(data('NASDAQ:AAPL'))))
  render(<NativeChart symbol="NASDAQ:AAPL" />)
  expect(await screen.findByText('$315.34')).toBeVisible()
  expect(screen.getByText(/2026-09-09 16:00:01/)).toHaveTextContent('纽约时间')
  expect(screen.getByRole('img', { name: /收盘价走势/ })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '日 K' }))
  expect(screen.getByRole('img', { name: /日 K 线/ })).toBeVisible()
  fireEvent.change(screen.getByRole('slider'), { target: { value: '0' } })
  expect(screen.getByText('开 317.10')).toBeVisible()
})
it('clears the previous symbol immediately and ignores its late response', async () => {
  let old!: (value: unknown) => void
  vi.stubGlobal('fetch', vi.fn().mockImplementationOnce(() => new Promise(resolve => { old = resolve })).mockResolvedValueOnce(ok(data('NASDAQ:NVDA', 223.67))))
  const view = render(<NativeChart symbol="NASDAQ:AAPL" />)
  view.rerender(<NativeChart symbol="NASDAQ:NVDA" />)
  expect(await screen.findByText('$223.67')).toBeVisible()
  await act(async () => { old(ok(data('NASDAQ:AAPL'))); await Promise.resolve() })
  expect(screen.queryByText('$315.34')).not.toBeInTheDocument()
})
it('retains an old quote only with an explicit failed-refresh warning', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(ok(data('NASDAQ:AAPL'))).mockRejectedValue(new Error('offline')))
  render(<NativeChart symbol="NASDAQ:AAPL" />)
  await screen.findByText('$315.34')
  fireEvent.click(screen.getByRole('button', { name: '刷新行情' }))
  expect(await screen.findByText(/保留上次取得的数据/)).toBeVisible()
  expect(screen.getByText('$315.34')).toBeVisible()
})
it('shows a useful source link and retry when both quote and history fail', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
  render(<NativeChart symbol="NYSE:BRK.B" />)
  expect(await screen.findByText(/行情暂时未能更新/)).toBeVisible()
  expect(screen.getByRole('link', { name: /腾讯行情/ })).toHaveAttribute('href', 'https://gu.qq.com/usBRK.B.N')
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
})
it('loads no TradingView scripts or iframes in the default dashboard', async () => {
  const fetch = vi.fn().mockImplementation((url: string) => Promise.resolve(ok(url.includes('symbol=') ? data('NASDAQ:AAPL') : { source: '腾讯行情', fetchedAt: Date.now(), quotes: [] })))
  vi.stubGlobal('fetch', fetch)
  render(<MarketDashboard />)
  await screen.findByText('$315.34')
  expect(document.querySelector('iframe')).toBeNull()
  expect(document.querySelector('script[src*="tradingview"]')).toBeNull()
  expect(fetch.mock.calls.every(([url]) => String(url).startsWith('/api/us-markets'))).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'TradingView 高级版' }))
  await waitFor(() => expect(document.querySelector('script[src*="tradingview"]')).not.toBeNull())
  fireEvent.click(screen.getByRole('button', { name: '本站行情' }))
  expect(document.querySelector('script[src*="tradingview"]')).toBeNull()
})
