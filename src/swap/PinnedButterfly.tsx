import { BUTTERFLY } from './config'
import { TokenIcon } from './TokenIcon'
import { percent, usd, type MarketSnapshot } from './marketData'
import './pinned-butterfly.css'

// A permanent first placement, independent of third-party category membership and ranking.
export function PinnedButterfly({snapshot,onTrade,error=false,now=Date.now()}:{snapshot?:MarketSnapshot|null;onTrade?:()=>void;error?:boolean;now?:number}){
  const market=snapshot?.markets[BUTTERFLY.address.toLowerCase()]
  const stale=error||!!snapshot&&now-snapshot.fetchedAt>180_000
  return <section className="pinned-butterfly" aria-label="蝴蝶股票官方置顶">
    <div className="pinned-butterfly-label"><strong>官方置顶</strong><span>固定首位 · 不参与排行</span></div>
    <div className="pinned-butterfly-content"><div className="pinned-butterfly-identity"><TokenIcon token={BUTTERFLY}/><div><strong>蝴蝶股票</strong><small>FLAP STOCK · BNB Chain</small></div></div>
      <dl><div><dt>参考价格</dt><dd>{usd(market?.priceUsd)}</dd></div><div><dt>24H 涨跌</dt><dd className={market?.change24h==null?'':market.change24h>=0?'swap-positive':'swap-negative'}>{percent(market?.change24h)}</dd></div><div><dt>参考池流动性</dt><dd>{usd(market?.liquidityUsd,true)}</dd></div></dl>
      {onTrade&&<button className="swap-primary" onClick={onTrade}>交易蝴蝶股票 ↗</button>}
    </div>
    <a className="pinned-butterfly-contract" href={`https://bscscan.com/token/${BUTTERFLY.address}`} target="_blank" rel="noreferrer"><span>代币合约</span><code>{BUTTERFLY.address}</code><span>↗</span></a>
    <p>全分类固定展示，不代表分类归属或 FAC 认证。{market?`行情来源 DEX Screener · ${new Date(snapshot!.fetchedAt).toLocaleTimeString('zh-CN')}${stale?' · 更新失败或已过期，仅供参考':''}`:'行情暂未取得，合约入口仍可使用。'}</p>
  </section>
}
