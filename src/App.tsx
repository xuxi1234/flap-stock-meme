import { useEffect, useState } from 'react'
import { Faq } from './components/Faq'
import { Hero } from './components/Hero'
import { HowToJoin } from './components/HowToJoin'
import { MobilePresaleDock } from './components/MobilePresaleDock'
import { NameCore } from './components/NameCore'
import { ParticipationRules } from './components/ParticipationRules'
import { Presale, type PresaleDisplayStatus } from './components/Presale'
import { ProjectUpdates } from './components/ProjectUpdates'
import { PublicProof } from './components/PublicProof'
import { SiteFooter } from './components/SiteFooter'
import { SiteHeader } from './components/SiteHeader'
import { TickerStrip } from './components/TickerStrip'
import { siteContent, type Language } from './content/siteContent'

export default function App() {
  const [language, setLanguage] = useState<Language>('zh')
  const [presaleStatus, setPresaleStatus] = useState<PresaleDisplayStatus>('live')
  const copy = siteContent[language]
  useEffect(() => { document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en' }, [language])
  return <div className="site-shell">
    <div className="site-grid" aria-hidden="true" />
    <SiteHeader copy={copy.nav} communityCopy={copy.community} language={language} onLanguageChange={setLanguage} />
    <main id="top">
      <Hero copy={copy.hero} />
      <TickerStrip copy={copy.ticker} />
      <ParticipationRules copy={copy.participationRules} />
      <Presale copy={copy.presale} onStatusChange={setPresaleStatus} />
      <HowToJoin copy={copy.howTo} />
      <PublicProof copy={copy.publicProof} />
      <ProjectUpdates copy={copy.updates} />
      <NameCore copy={copy.nameCore} />
      <Faq copy={copy.faq} />
    </main>
    <SiteFooter copy={copy.footer} communityCopy={copy.community} />
    <MobilePresaleDock copy={copy.hero} status={presaleStatus} />
  </div>
}
