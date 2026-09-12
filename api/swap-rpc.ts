// Bounded, read-only BSC relay. It never receives a signer or broadcasts a transaction.
const upstreams = ['https://bsc-dataseed.bnbchain.org', 'https://bsc-rpc.publicnode.com']
const allowed = new Set(['eth_chainId', 'eth_blockNumber', 'eth_call', 'eth_getBalance', 'eth_getCode', 'eth_estimateGas', 'eth_gasPrice', 'eth_getTransactionReceipt', 'eth_getTransactionByHash', 'eth_getBlockByNumber', 'eth_getTransactionCount'])
type Request = { method?: string; body: unknown }
type Response = { setHeader: (name: string, value: string) => void; status: (code: number) => Response; json: (value: unknown) => void }
export default async function handler(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST required' }); return }
  let body: unknown
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body } catch { res.status(400).json({ error: 'Invalid JSON' }); return }
  // viem omits params for no-argument reads such as eth_gasPrice.
  const normalize = (item: unknown) => item && typeof item === 'object' ? { ...item, params: (item as { params?: unknown }).params ?? [] } : item
  const normalized = Array.isArray(body) ? body.map(normalize) : normalize(body)
  const items = Array.isArray(normalized) ? normalized : [normalized]
  const serialized = JSON.stringify(normalized)
  if (!serialized || serialized.length > 40_000 || items.length < 1 || items.length > 10 || items.some(item => !item || typeof item !== 'object' || !allowed.has(item.method) || item.jsonrpc !== '2.0' || !Array.isArray(item.params) || item.params.length > 2)) {
    res.status(400).json({ error: 'Unsupported read request' }); return
  }
  for (const endpoint of upstreams) {
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: serialized, signal: AbortSignal.timeout(6000) })
      if (!response.ok) continue
      const value = await response.json()
      // Preserve contract reverts so the client can distinguish unavailable pools.
      res.status(200).json(value); return
    } catch { /* try the independent public endpoint */ }
  }
  res.status(503).json({ jsonrpc: '2.0', id: Array.isArray(body) ? null : (body as { id?: unknown })?.id ?? null, error: { code: -32000, message: 'BSC read service temporarily unavailable' } })
}
