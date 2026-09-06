import { useState } from 'react'
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
  const [menuOpen, setMenuOpen] = useState(false)

  const changeLanguage = () => {
    setMenuOpen(false)
    onLanguageChange(nextLanguage)
  }

  return (
    <header className="site-header">
      <a className="brand-lockup" href="#top" aria-label={copy.homeLabel}>
        <img src="/flap-stock-logo.png" alt={copy.logoLabel} />
        <span><strong>{projectConfig.brand.englishName}</strong><small>{projectConfig.brand.symbol}</small></span>
      </a>
      <nav id="primary-navigation" aria-label={copy.navigationLabel} data-open={menuOpen}>
        <a href="#story" onClick={() => setMenuOpen(false)}>{copy.story}</a>
        <a href="#signal" onClick={() => setMenuOpen(false)}>{copy.signal}</a>
        <a href="#presale" onClick={() => setMenuOpen(false)}>{copy.presale}</a>
        <a href="#roadmap" onClick={() => setMenuOpen(false)}>{copy.roadmap}</a>
      </nav>
      <CommunityLinks className="header-community" copy={communityCopy} />
      <div className="header-controls">
        <button className="language-toggle" type="button" onClick={changeLanguage} aria-label={copy.languageSwitchLabel}>{copy.languageLabel}</button>
        <button className="menu-toggle" type="button" aria-controls="primary-navigation" aria-expanded={menuOpen} aria-label={menuOpen ? copy.menuCloseLabel : copy.menuOpenLabel} onClick={() => setMenuOpen((open) => !open)}>
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}
