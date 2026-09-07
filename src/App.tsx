import { useEffect, useState } from 'react'
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
  const copy = siteContent[language]
  useEffect(() => { document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en' }, [language])
  return <div className="site-shell">
    <div className="site-grid" aria-hidden="true" />
    <SiteHeader copy={copy.nav} communityCopy={copy.community} language={language} onLanguageChange={setLanguage} />
    <main id="top">
      <Hero copy={copy.hero} />
      <TickerStrip copy={copy.ticker} />
      <Presale copy={{ ...copy.presale, eyebrow: 'FLAP / PRESALE', title: language === 'zh' ? '每个地址，固定 0.05 BNB。' : 'ONE ADDRESS. FIXED 0.05 BNB.', body: language === 'zh' ? '连接 BSC 钱包，查看实时状态后参与。每地址仅一次；网络费由钱包另行显示。' : 'Connect a BSC wallet and check the live status before joining. One entry per address; network fees are shown separately in your wallet.' }} onStatusChange={setPresaleStatus} />
      <PresaleShare language={language} />
      <TokenMechanism language={language} />
      <NameCore copy={{ ...copy.nameCore, eyebrow: 'BRAND STORY' }} />
      <CommunitySection language={language} />
    </main>
    <SiteFooter copy={copy.footer} communityCopy={copy.community} />
    <MobilePresaleDock copy={{ ...copy.hero, enterPresale: language === 'zh' ? '进入预售' : 'OPEN PRESALE' }} status={presaleStatus} />
  </div>
}
