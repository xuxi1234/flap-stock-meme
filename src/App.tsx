import { useEffect, useState } from 'react'
import { Hero } from './components/Hero'
import { NameCore } from './components/NameCore'
import { TokenMechanism } from './components/TokenMechanism'
import { SiteFooter } from './components/SiteFooter'
import { SiteHeader } from './components/SiteHeader'
import { TickerStrip } from './components/TickerStrip'
import { siteContent, type Language } from './content/siteContent'

export default function App() {
  const [language, setLanguage] = useState<Language>('zh')
  const copy = siteContent[language]
  useEffect(() => { document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en' }, [language])
  return <div className="site-shell">
    <div className="site-grid" aria-hidden="true" />
    <SiteHeader copy={copy.nav} communityCopy={copy.community} language={language} onLanguageChange={setLanguage} />
    <main id="top">
      <Hero copy={copy.hero} />
      <TickerStrip copy={copy.ticker} />
      <TokenMechanism language={language} />
      <NameCore copy={{ ...copy.nameCore, eyebrow: 'BRAND STORY' }} />
    </main>
    <SiteFooter copy={copy.footer} communityCopy={copy.community} />
  </div>
}
