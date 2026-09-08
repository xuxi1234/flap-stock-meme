import { lazy, Suspense, useEffect, useState } from 'react'
const MarketDashboard = lazy(() => import('./components/MarketDashboard').then(module => ({ default: module.MarketDashboard })))
import { Hero } from './components/Hero'
import { NameCore } from './components/NameCore'
import { TokenMechanism } from './components/TokenMechanism'
import { CommunitySection } from './components/CommunitySection'
import { Presale, type PresaleDisplayStatus } from './components/Presale'
import { PresaleShare } from './components/PresaleShare'
import { MobilePresaleDock } from './components/MobilePresaleDock'
import { SiteFooter } from './components/SiteFooter'
import { SiteHeader } from './components/SiteHeader'
import { TickerStrip } from './components/TickerStrip'
import { siteContent, type Language } from './content/siteContent'

export default function App() {
  const [language, setLanguage] = useState<Language>('zh')
  const [presaleStatus, setPresaleStatus] = useState<PresaleDisplayStatus>('unavailable')
  const [shareAccount, setShareAccount] = useState<`0x${string}` | null>(null)
  const [walletRequest, setWalletRequest] = useState(0)
  const openWallet = () => { setWalletRequest(value => value + 1) }
  const walletEntry = () => {
    if (shareAccount) document.getElementById('presale')?.scrollIntoView({ behavior: 'smooth' })
    else openWallet()
  }
  const copy = siteContent[language]
  useEffect(() => { document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en' }, [language])
  if (new URLSearchParams(window.location.search).get('view') === 'markets') return <Suspense fallback={<main style={{ padding: 32 }} role="status">正在打开美股看板…</main>}><MarketDashboard /></Suspense>
  return <div className="site-shell">
    <div className="site-grid" aria-hidden="true" />
    <SiteHeader account={shareAccount} onWalletClick={walletEntry} copy={copy.nav} communityCopy={copy.community} language={language} onLanguageChange={setLanguage} />
    <main id="top">
      <Hero onWalletClick={walletEntry} copy={copy.hero} language={language} />
      <TickerStrip copy={copy.ticker} />
      <section className="market-home-entry" aria-label={language === 'zh' ? '美股动态' : 'US stock market'}>
        <div><p className="eyebrow">FLAP STOCK / US MARKETS</p><h2>{language === 'zh' ? '美股动态，随时掌握。' : 'FOLLOW THE US MARKET.'}</h2><p>{language === 'zh' ? '查看股票走势、大盘 ETF、涨跌榜与公司新闻，收藏并分享你关注的股票。' : 'Explore stock charts, market ETFs and movers. Save companies to your watchlist.'}</p><small>{language === 'zh' ? 'TradingView 提供行情 · 数据可能延迟 · 无需连接钱包' : 'Data by TradingView · Quotes may be delayed · No wallet required'}</small></div>
        <a className="button button-primary" href="/?view=markets">{language === 'zh' ? '打开美股看板 ↗' : 'OPEN STOCK DASHBOARD ↗'}</a>
      </section>
      <Presale walletRequest={walletRequest} copy={{ ...copy.presale, eyebrow: 'FLAP / PRESALE', title: language === 'zh' ? '每个地址，固定 0.05 BNB。' : 'ONE ADDRESS. FIXED 0.05 BNB.', body: language === 'zh' ? '连接 BSC 钱包，查看实时状态后参与。每地址仅一次；网络费由钱包另行显示。' : 'Connect a BSC wallet and check the live status before joining. One entry per address; network fees are shown separately in your wallet.' }} onAccountChange={setShareAccount} onStatusChange={setPresaleStatus} />
      <PresaleShare onConnect={openWallet} language={language} account={shareAccount} />
      <TokenMechanism language={language} />
      <NameCore copy={{ ...copy.nameCore, eyebrow: 'BRAND STORY' }} />
      <CommunitySection language={language} />
    </main>
    <SiteFooter copy={copy.footer} communityCopy={copy.community} />
    <MobilePresaleDock account={shareAccount} onWalletClick={walletEntry} language={language} copy={{ ...copy.hero, enterPresale: language === 'zh' ? '进入预售' : 'OPEN PRESALE' }} status={presaleStatus} />
  </div>
}
