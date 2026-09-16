// Read-only discovery. Upstream values never supply transaction parameters or decimals.
export const BOARD_CATEGORIES = [
  { id: 'trending', label: '热门', icon: '◈', description: 'Flap 热门代币，支持按市值、成交额和涨跌幅排序。' },
  { id: 'unusual', label: '不对劲', icon: '◇', description: '蝴蝶异动筛选：当前已加载热门中，5 分钟涨跌绝对值 ≥ 5%，或 1 小时 ≥ 10%。与 Flap 专属榜单不同。' },
  { id: 'stocks', label: '股票', icon: '▥', description: 'Flap 股票分类；美股代币本身请切换「代币排行」。' },
  { id: 'bonding', label: '内盘打新', icon: '↗', description: 'Flap 内盘代币。内盘交易通过 Flap 进行，尚不能使用 Pancake 路由。' },
  { id: 'listadao', label: 'LISTADAO', icon: 'L', description: 'Flap LISTADAO 分类，按上游分类结果展示。' },
  { id: 'gifts', label: '礼物代币', icon: '♧', description: 'Flap 礼物代币分类，按上游分类结果展示。' },
  { id: 'innovation', label: '创新', icon: '✧', description: '展示 Flap 标记的创新代币。' },
  { id: 'fac', label: 'FAC 认证', icon: '✓', description: 'FAC 是 Flap 的认证标记，不是蝴蝶 Swap 的安全保证或保本承诺。' },
] as const
export type BoardCategory = typeof BOARD_CATEGORIES[number]['id']
export const BOARD_SORTS = { default: '默认排行', marketcap: '市值', volume24h: '24H 成交额', holders: '持有人', liquidity: '流动性', '5m': '5M 涨跌', '1h': '1H 涨跌', '4h': '4H 涨跌', '24h': '24H 涨跌' } as const
export type BoardSort = keyof typeof BOARD_SORTS
export type BoardRow = { address: string; name: string; symbol: string; image: string | null; listed: boolean | null; quoteAddress: string; price: number | null; marketCap: number | null; volume24h: number | null; holders: number | null; liquidity: number | null; progress: number | null; change5m: number | null; change1h: number | null; change4h: number | null; change24h: number | null; buyTaxBps: number | null; sellTaxBps: number | null; fac: boolean; innovation: boolean }
export type BoardSnapshot = { category: BoardCategory; items: BoardRow[]; nextCursor: string | null; fetchedAt: number; source: 'api' | 'page'; scope: string; sourceUpdatedAt?: number }
export const ADDRESS = /^0x[\da-fA-F]{40}$/
const ZERO = '0x' + '0'.repeat(40)
const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
const numeric = (v: unknown, min = -Infinity, max = Infinity) => (typeof v === 'number' || typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) && Number.isFinite(Number(v)) && Number(v) >= min && Number(v) <= max ? Number(v) : null
const integer = (v: unknown, max = Number.MAX_SAFE_INTEGER) => { const n = numeric(v, 0, max); return n !== null && Number.isSafeInteger(n) ? n : null }
const text = (v: unknown, max: number) => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max) : ''
function imageUrl(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const cid = v.replace(/^ipfs:\/\//, '')
  if (/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z2-7]{20,120}|bafk[a-z2-7]{20,120})$/.test(cid)) return `https://flap.mypinata.cloud/ipfs/${cid}`
  try { const url = new URL(v); return url.protocol === 'https:' && !url.username && !url.password && v.length < 1000 ? url.href : null } catch { return null }
}
export function normalizeBoard(value: unknown): { items: BoardRow[]; nextCursor: string | null } {
  const body = object(value)
  if (!Array.isArray(body.items) || body.items.length > 200) throw Error('Invalid board response')
  const seen = new Set<string>(), items: BoardRow[] = []
  for (const item of body.items) {
    const r = object(item), coin = object(r.coin), tax = object(r.tax)
    const address = typeof coin.address === 'string' ? coin.address.toLowerCase() : ''
    if (!ADDRESS.test(address) || address === ZERO || seen.has(address)) continue
    seen.add(address)
    items.push({ address, name: text(coin.name,120), symbol: text(coin.symbol,40) || address.slice(0,8), image: imageUrl(coin.image),
      listed: typeof r.listed === 'boolean' ? r.listed : null,
      // Flap omits quoteToken for native BNB. An invalid explicit value stays unknown.
      quoteAddress: r.quoteToken == null ? ZERO : typeof r.quoteToken === 'string' && ADDRESS.test(r.quoteToken) ? r.quoteToken.toLowerCase() : '',
      price: numeric(r.price,0), marketCap: numeric(r.marketCap,0), volume24h: numeric(r.volume24h,0), holders: integer(r.holders), liquidity: numeric(r.liquidity,0), progress: numeric(r.progress,0,100),
      change5m: numeric(r.change5m), change1h: numeric(r.change1h), change4h: numeric(r.change4h), change24h: numeric(r.change24h),
      buyTaxBps: integer(tax.buyTaxBps,10000), sellTaxBps: integer(tax.sellTaxBps,10000), fac: r.isLowRisk === true, innovation: r.isInnovation === true })
  }
  return { items, nextCursor: typeof body.nextCursor === 'string' && body.nextCursor.length <= 512 ? body.nextCursor : null }
}
// Parse JSON strings from the publicly served page. Never execute downloaded scripts.
export function parsePublicBoard(html: string): unknown {
  if (html.length > 2_000_000) throw Error('Page too large')
  for (const match of html.matchAll(/self\.__next_f\.push\((\[[^\n]*?\])\)<\/script>/g)) {
    try {
      const payload: unknown = JSON.parse(match[1])
      if (!Array.isArray(payload) || typeof payload[1] !== 'string') continue
      const record = payload[1].slice(payload[1].indexOf(':') + 1).trim()
      const tree: unknown = JSON.parse(record)
      if (Array.isArray(tree) && object(tree[3]).initialBoard) return {...object(object(tree[3]).initialBoard), sourceUpdatedAt: object(tree[3]).initialDataUpdatedAt}
    } catch { /* non-JSON stream records */ }
  }
  throw Error('Public board unavailable')
}
export function isUnusual(r: BoardRow) { return r.change5m !== null && Math.abs(r.change5m) >= 5 || r.change1h !== null && Math.abs(r.change1h) >= 10 }
export function boardValue(r: BoardRow, sort: BoardSort) { return ({default:null,marketcap:r.marketCap,volume24h:r.volume24h,holders:r.holders,liquidity:r.liquidity,'5m':r.change5m,'1h':r.change1h,'4h':r.change4h,'24h':r.change24h})[sort] }
export function sortBoard(rows: BoardRow[], sort: BoardSort, order: 'asc'|'desc') {
  if (sort === 'default') return [...rows]
  return [...rows].sort((a,b) => { const x=boardValue(a,sort),y=boardValue(b,sort); return x===null ? y===null ? 0 : 1 : y===null ? -1 : (x-y)*(order==='asc'?1:-1) })
}
