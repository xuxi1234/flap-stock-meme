import { useMemo, useState } from 'react'
import { MAG7_SYMBOLS, STOCK_TOKENS, matchesToken, type SwapToken } from './config'
import { TokenIcon } from './TokenIcon'
import { percent, usd, type MarketSnapshot, type TokenMarket } from './marketData'

type Props = { onSelect: (token: SwapToken) => void; favorites: string[]; onFavorite: (address: string) => void; snapshot: MarketSnapshot | null; loading: boolean; error: boolean; onRefresh: () => void; now: number; storageError: boolean }
export function AssetExplorer({ onSelect, favorites, onFavorite, snapshot, loading, error, onRefresh, now, storageError }: Props) {
  const [filter, setFilter] = useState('mag7')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('default')
  const stale = !!snapshot && now - snapshot.fetchedAt > 180_000
  const visible = useMemo(() => {
    const rows = STOCK_TOKENS.filter(t => matchesToken(t, query) && (filter === 'all' || filter === 'mag7' && MAG7_SYMBOLS.includes(t.stockSymbol ?? '') || filter === 'etf' && t.category === 'etf' || filter === 'favorites' && favorites.includes(t.address.toLowerCase())))
    if (sort === 'name') rows.sort((a, b) => a.symbol.localeCompare(b.symbol))
    if (sort === 'liquidity') rows.sort((a, b) => (snapshot?.markets[b.address.toLowerCase()]?.liquidityUsd ?? -1) - (snapshot?.markets[a.address.toLowerCase()]?.liquidityUsd ?? -1))
    return rows
  }, [filter, query, sort, favorites, snapshot])
  return <section id="swap-discover" className="swap-explorer" aria-label="资产发现">
    <div className="swap-explorer-heading"><div><p className="swap-eyebrow">EXPLORE / ON-CHAIN ASSETS</p><h2>下一站，你看好谁？</h2><p>从熟悉的公司开始，找到你的链上资产。</p></div><div className="swap-catalog-count"><strong>{STOCK_TOKENS.length}</strong><span>项已收录资产<small>BNB CHAIN · bStocks</small></span></div></div>
    <div className="swap-explorer-controls"><div className="swap-discovery-filters" role="group" aria-label="资产分类">{[['mag7','美股七姐妹'],['all','全部资产'],['etf','ETF'],['favorites',`我的收藏 ${favorites.length}`]].map(([key, label]) => <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{key === 'favorites' ? '☆ ' : ''}{label}</button>)}</div><div className="swap-explorer-search"><input aria-label="搜索资产目录" placeholder="搜索公司、代码或合约" value={query} onChange={e => { setQuery(e.target.value); if (e.target.value) setFilter('all') }} maxLength={100} /><select aria-label="资产排序" value={sort} onChange={e => setSort(e.target.value)}><option value="default">默认顺序</option><option value="name">代码 A–Z</option><option value="liquidity">参考池流动性</option></select></div></div>
    <div className="swap-market-status"><span>{loading ? '正在更新链上行情…' : error ? '行情更新失败' : snapshot ? '链上行情已载入' : '暂无行情'}{snapshot && ` · ${new Date(snapshot.fetchedAt).toLocaleTimeString('zh-CN', { hour12: false })}`}{stale && ' · 数据已过期'}</span><button disabled={loading} onClick={onRefresh}>刷新 ↻</button></div>
    {(error || stale) && <p className="swap-small-note" role="status">{snapshot ? '以下为上次获取的数据。' : '暂无参考行情，资产仍可选择。'}兑换框会独立查询当前链上报价。</p>}
    <div className="swap-explorer-grid">{visible.map(t => {
      const market = snapshot?.markets[t.address.toLowerCase()]
      const favorite = favorites.includes(t.address.toLowerCase())
      return <article className="swap-explorer-card" key={t.address}>
        <div className="swap-explorer-card-head"><TokenIcon token={t} /><div><h3>{t.name.split(' / ')[0]}</h3><span>{t.stockSymbol} <i>·</i> {t.symbol}</span></div><button className="swap-favorite" aria-label={`${favorite ? '取消收藏' : '收藏'} ${t.symbol}`} aria-pressed={favorite} onClick={() => onFavorite(t.address)}>{favorite ? '★' : '☆'}</button></div>
        <div className="swap-explorer-price"><strong>{usd(market?.priceUsd)}</strong><span className={market?.change24h == null ? '' : market.change24h >= 0 ? 'swap-positive' : 'swap-negative'}>{percent(market?.change24h)}<small>24H</small></span></div>
        <div className="swap-explorer-metrics"><span>参考池流动性<b>{usd(market?.liquidityUsd, true)}</b></span><span>池内 24H 成交<b>{usd(market?.volume24h, true)}</b></span></div>
        <div className="swap-explorer-card-foot"><span>{market ? `${market.dex} ${market.protocol}` : loading ? '行情加载中' : '暂无参考池'}<small>已收录{t.category === 'etf' ? ' · ETF' : ' · bStocks'}</small></span><button onClick={() => onSelect(t)}>选择资产 ↗</button></div>
      </article>
    })}</div>
    {!visible.length && <div className="swap-explorer-empty"><span>☆</span><h3>{filter === 'favorites' ? '把关注的资产，留在这里。' : '没有找到对应资产'}</h3><p>{filter === 'favorites' ? '点击资产卡片上的星标，下次打开还在。' : '试试公司中文名、英文代码或完整合约。'}</p><button onClick={() => { setFilter('all'); setQuery('') }}>浏览全部资产 →</button></div>}
    {storageError && <p role="status" className="swap-small-note">当前浏览器无法保存收藏，仅在本次页面有效。</p>}
    <div className="swap-explorer-source"><p>链上参考价来自 DEX Screener 收录的 PancakeSwap 参考池，优先取返回结果中流动性较高的 USDT / USDC / WBNB 池。涨跌、成交额和流动性均为该池数据；不等于美股行情或实际兑换报价。</p><a href="/butterfly-stock-list.json" target="_blank" rel="noopener noreferrer">公开代币列表 ↗</a></div>
  </section>
}

export function MarketDetail({ token, market, stale, onCopy }: { token: SwapToken; market?: TokenMarket; stale: boolean; onCopy: (text: string) => void }) {
  if (!token.stockSymbol) return null
  return <details className="swap-asset-info"><summary><TokenIcon token={token} /><span>{token.name.split(' / ')[0]}<small>{token.stockSymbol} · 已收录</small></span><b>资产详情 ⌄</b></summary><div className="swap-asset-info-body"><div className="swap-info-market"><span>链上参考价<strong>{usd(market?.priceUsd)}</strong></span><span>参考池 24H 涨跌<strong className={(market?.change24h ?? 0) >= 0 ? 'swap-positive' : 'swap-negative'}>{percent(market?.change24h)}</strong></span></div>{stale && <p className="swap-small-note">参考行情已过期，请刷新资产看板。</p>}<p>{token.issuer}</p><div className="swap-contract-copy"><code>{token.address}</code><button aria-label={`复制 ${token.symbol} 合约`} onClick={() => onCopy(token.address)}>复制</button></div><div className="swap-info-links"><a href={`https://bscscan.com/token/${token.address}`} target="_blank" rel="noopener noreferrer">链上记录 ↗</a><a href={token.source} target="_blank" rel="noopener noreferrer">发行资料 ↗</a>{market && <a href={`https://dexscreener.com/bsc/${market.pairAddress}`} target="_blank" rel="noopener noreferrer">{market.protocol} 参考池 ↗</a>}</div><p className="swap-small-note">当前兑换使用 V2。参考池可能是 V3，池内价格不能直接作为本次成交价；收录不代表安全担保。</p></div></details>
}
