import { afterEach, expect, it, vi } from 'vitest'
import handler from '../../api/swap-rpc'
const response = () => { const res = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn() }; res.status.mockReturnValue(res); return res }
afterEach(() => vi.unstubAllGlobals())
it('never forwards broadcasts, signing requests or state overrides', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
  for (const body of [
    { jsonrpc: '2.0', id: 1, method: 'eth_sendRawTransaction', params: ['0x00'] },
    { jsonrpc: '2.0', id: 1, method: 'personal_sign', params: [] },
    { jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{}, 'latest', {}] },
  ]) { const res = response(); await handler({ method: 'POST', body }, res); expect(res.status).toHaveBeenCalledWith(400) }
  expect(fetch).not.toHaveBeenCalled()
})
it('falls back after a failed public node and never accepts a caller supplied upstream', async () => {
  const fetch = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ok: true, json: async () => ({ result: '0x38' }) }); vi.stubGlobal('fetch', fetch)
  const res = response(); await handler({ method: 'POST', body: { jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [], url: 'http://localhost/' } }, res)
  expect(fetch.mock.calls[0][0]).toBe('https://bsc-dataseed.bnbchain.org'); expect(fetch.mock.calls[1][0]).toBe('https://bsc-rpc.publicnode.com'); expect(res.json).toHaveBeenCalledWith({ result: '0x38' })
})
it('rejects oversized batches without forwarding', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch); const res = response()
  await handler({ method: 'POST', body: Array(11).fill({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }) }, res)
  expect(res.status).toHaveBeenCalledWith(400); expect(fetch).not.toHaveBeenCalled()
})
it('normalizes viem no-argument reads without enabling write methods', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: '0x1' }) }); vi.stubGlobal('fetch', fetch)
  const res = response(); await handler({ method: 'POST', body: { jsonrpc: '2.0', id: 1, method: 'eth_gasPrice' } }, res)
  expect(JSON.parse(fetch.mock.calls[0][1].body).params).toEqual([])
  expect(res.status).toHaveBeenCalledWith(200)
})
