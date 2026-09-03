import type { Language, SiteCopy } from '../content/siteContent'
import { projectConfig } from '../config/project'
import { CommunityLinks } from './CommunityLinks'

type Props = {
  copy: SiteCopy['nav']
  communityCopy: SiteCopy['community']
  language: Language
  onLanguageChange: (language: Language) => void
}

export function SiteHeader({ copy, communityCopy, language, onLanguageChange }: Props) {
  const nextLanguage: Language = language === 'zh' ? 'en' : 'zh'

  return (
    <header className="site-header">
      <a className="brand-lockup" href="#top" aria-label={copy.homeLabel}>
        <img src="/flap-stock-logo.png" alt={copy.logoLabel} />
        <span><strong>{projectConfig.brand.englishName}</strong><small>{projectConfig.brand.symbol}</small></span>
      </a>
      <nav aria-label={copy.navigationLabel}>
        <a href="#story">{copy.story}</a>
        <a href="#signal">{copy.signal}</a>
        <a href="#presale">{copy.presale}</a>
        <a href="#roadmap">{copy.roadmap}</a>
      </nav>
      <CommunityLinks className="header-community" copy={communityCopy} />
      <button className="language-toggle" type="button" onClick={() => onLanguageChange(nextLanguage)} aria-label={copy.languageSwitchLabel}>{copy.languageLabel}</button>
    </header>
  )
}
