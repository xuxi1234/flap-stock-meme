import { Component, lazy, Suspense, useEffect, type ReactNode } from 'react'

const HomePage = lazy(() => import('./HomePage'))
const MarketDashboard = lazy(() => import('./components/MarketDashboard').then(module => ({ default: module.MarketDashboard })))
const SwapPage = lazy(() => import('./swap/SwapPage').then(module => ({ default: module.SwapPage })))
const AirdropPage = lazy(() => import('./airdrop/AirdropPage'))
const NFTPage = lazy(() => import('./nft/NFTPage'))

class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <main style={{padding:32}} role="alert"><h1>页面暂时未能打开</h1><p>请检查网络后重新加载。</p><button onClick={() => window.location.reload()}>重新加载页面</button><a href="/" style={{marginLeft:16}}>返回首页</a></main>
    return this.props.children
  }
}
export default function App() {
  useEffect(() => {
    const url = new URL(window.location.href)
    const legacyView = ['presale', 'presale-admin'].includes(url.searchParams.get('view') ?? '')
    if (legacyView) url.searchParams.delete('view')
    if (url.hash === '#presale') url.hash = ''
    if (url.searchParams.get('utm_campaign') === 'presale') url.searchParams.delete('utm_campaign')
    if (url.href !== window.location.href) window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  }, [])
  const params = new URLSearchParams(window.location.search)
  const nft = params.get('view') === 'nft' || window.location.pathname === '/nft'
  const airdrop = params.get('view') === 'airdrop' || window.location.pathname === '/airdrop'
  const markets = params.get('view') === 'markets' || params.has('tvwidgetsymbol')
  const swap = params.get('view') === 'swap' || ['app.gupiao.sh', 'app.hudiegupiao.com'].includes(window.location.hostname)
  return <PageBoundary><Suspense fallback={<main style={{padding:32}} role="status">正在打开{nft ? '蝴蝶 NFT' : airdrop ? '蝴蝶空投' : swap ? '蝴蝶swap' : markets ? '美股看板' : '蝴蝶股票'}…</main>}>{nft ? <NFTPage /> : airdrop ? <AirdropPage /> : swap ? <SwapPage /> : markets ? <MarketDashboard /> : <HomePage />}</Suspense></PageBoundary>
}
