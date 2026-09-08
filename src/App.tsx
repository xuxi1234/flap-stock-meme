import { Component, lazy, Suspense, type ReactNode } from 'react'

const HomePage = lazy(() => import('./HomePage'))
const MarketDashboard = lazy(() => import('./components/MarketDashboard').then(module => ({ default: module.MarketDashboard })))

class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <main style={{padding:32}} role="alert"><h1>页面暂时未能打开</h1><p>请检查网络后重新加载。</p><button onClick={() => window.location.reload()}>重新加载页面</button><a href="/" style={{marginLeft:16}}>返回首页</a></main>
    return this.props.children
  }
}
export default function App() {
  const markets = new URLSearchParams(window.location.search).get('view') === 'markets'
  return <PageBoundary><Suspense fallback={<main style={{padding:32}} role="status">正在打开{markets ? '美股看板' : '蝴蝶股票'}…</main>}>{markets ? <MarketDashboard /> : <HomePage />}</Suspense></PageBoundary>
}
