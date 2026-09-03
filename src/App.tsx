import { useEffect, useState } from 'react'
import { ButterflyEffect } from './components/ButterflyEffect'
import { Hero } from './components/Hero'
import { HowToJoin } from './components/HowToJoin'
import { Manifesto } from './components/Manifesto'
import { NameCore } from './components/NameCore'
import { PresaleConsole } from './components/PresaleConsole'
import { Roadmap } from './components/Roadmap'
import { SignalTerminal } from './components/SignalTerminal'
import { SiteFooter } from './components/SiteFooter'
import { SiteHeader } from './components/SiteHeader'
import { TickerStrip } from './components/TickerStrip'
import { siteContent, type Language } from './content/siteContent'

export default function App() {
  const [language, setLanguage] = useState<Language>('zh')
  const copy = siteContent[language]

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'
  }, [language])

  return (
    <div className="site-shell">
      <div className="site-grid" aria-hidden="true" />
      <SiteHeader copy={copy.nav} communityCopy={copy.community} language={language} onLanguageChange={setLanguage} />
      <main id="top">
        <Hero copy={copy.hero} />
        <TickerStrip copy={copy.ticker} />
        <ButterflyEffect copy={copy.effect} />
        <SignalTerminal copy={copy.signal} />
        <NameCore copy={copy.nameCore} />
        <PresaleConsole copy={copy.presale} />
        <HowToJoin copy={copy.howTo} />
        <Roadmap copy={copy.roadmap} />
        <Manifesto copy={copy.manifesto} />
      </main>
      <SiteFooter copy={copy.footer} communityCopy={copy.community} />
    </div>
  )
}
