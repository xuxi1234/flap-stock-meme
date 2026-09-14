import { useEffect, useState } from 'react'
import { Hero } from './components/Hero'
import { NameCore } from './components/NameCore'
import { TokenMechanism } from './components/TokenMechanism'
import { CommunitySection } from './components/CommunitySection'
import { useHomeWallet } from './web3/useHomeWallet'
import { SiteFooter } from './components/SiteFooter'
import { SiteHeader } from './components/SiteHeader'
import { TickerStrip } from './components/TickerStrip'
import { siteContent, type Language } from './content/siteContent'

export default function HomePage() {
  const [language, setLanguage] = useState<Language>('zh')
  const { account, openWallet, walletDialog } = useHomeWallet(language)
  const copy = siteContent[language]
  useEffect(() => { document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en' }, [language])
  return <div className="site-shell">
    <div className="site-grid" aria-hidden="true" />
    <SiteHeader account={account} onWalletClick={openWallet} copy={copy.nav} communityCopy={copy.community} language={language} onLanguageChange={setLanguage} />
    {walletDialog}
    <main id="top">
      <Hero copy={copy.hero} language={language} />
      <TickerStrip copy={copy.ticker} />
      <section className="market-home-entry"><div><p className="eyebrow">BUTTERFLY AIRDROP</p><h2>把蝴蝶，送到更多钱包。</h2><p>200 个地址，每个 1 枚。由你的钱包支付代币和 Gas。</p></div><a className="button button-primary" href="/?view=community-airdrop">一键空投 ↗</a></section>
      <section className="market-home-entry" aria-label={language === 'zh' ? '美股动态' : 'US stock market'}>
        <div><p className="eyebrow">FLAP STOCK / US MARKETS</p><h2>{language === 'zh' ? '美股动态，随时掌握。' : 'FOLLOW THE US MARKET.'}</h2><p>{language === 'zh' ? '查看股票走势、板块热力图与公司新闻。自选支持备份，关注的股票随时继续看。' : 'Explore stock charts, market ETFs and movers. Save companies to your watchlist.'}</p><small>{language === 'zh' ? 'TradingView 提供行情 · 数据可能延迟 · 无需连接钱包' : 'Data by TradingView · Quotes may be delayed · No wallet required'}</small></div>
        <a className="button button-primary" href="/?view=markets">{language === 'zh' ? '打开美股看板 ↗' : 'OPEN STOCK DASHBOARD ↗'}</a>
      </section>
      <TokenMechanism language={language} />
      <NameCore copy={{ ...copy.nameCore, eyebrow: 'BRAND STORY' }} />
      <CommunitySection language={language} />
    </main>
    <SiteFooter copy={copy.footer} communityCopy={copy.community} />
  </div>
}
