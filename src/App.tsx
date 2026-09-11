import { Component, lazy, Suspense, type ReactNode } from 'react'

const PresaleDeadlineAdmin = lazy(() => import('./components/PresaleDeadlineAdmin').then(module => ({ default: module.PresaleDeadlineAdmin })))
const HomePage = lazy(() => import('./HomePage'))
const MarketDashboard = lazy(() => import('./components/MarketDashboard').then(module => ({ default: module.MarketDashboard })))
const SwapPage = lazy(() => import('./swap/SwapPage').then(module => ({ default: module.SwapPage })))

class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <main style={{padding:32}} role="alert"><h1>页面暂时未能打开</h1><p>请检查网络后重新加载。</p><button onClick={() => window.location.reload()}>重新加载页面</button><a href="/" style={{marginLeft:16}}>返回首页</a></main>
    return this.props.children
  }
}
export default function App() {
  const params = new URLSearchParams(window.location.search)
  if (params.get('view') === 'vault') return <iframe src="/vault/index.html" title="蝴蝶股票金库" style={{position:'fixed',inset:0,width:'100%',height:'100%',border:0,zIndex:100,background:'#050504'}} />
  const admin = params.get('view') === 'presale-admin'
  const markets = params.get('view') === 'markets' || params.has('tvwidgetsymbol')
  const swap = params.get('view') === 'swap' || ['app.gupiao.sh', 'app.hudiegupiao.com'].includes(window.location.hostname)
  return <PageBoundary><Suspense fallback={<main style={{padding:32}} role="status">正在打开{swap ? '蝴蝶swap' : markets ? '美股看板' : '蝴蝶股票'}…</main>}>{swap ? <SwapPage /> : admin ? <PresaleDeadlineAdmin /> : markets ? <MarketDashboard /> : <HomePage />}</Suspense></PageBoundary>
}
