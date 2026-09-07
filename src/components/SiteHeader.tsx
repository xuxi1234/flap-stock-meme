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
        <img src="/flap-stock-avatar.png" alt={copy.logoLabel} />
        <span><strong>{projectConfig.brand.englishName}</strong><small>{projectConfig.brand.symbol}</small></span>
      </a>
      <nav id="primary-navigation" aria-label={copy.navigationLabel} data-open={menuOpen}>
        <a href="#presale" onClick={() => setMenuOpen(false)}>{language === 'zh' ? '预售' : 'PRESALE'}</a>
        <a href="#mechanism" onClick={() => setMenuOpen(false)}>{language === 'zh' ? '代币机制' : 'TOKENOMICS'}</a>
        <a href="#story" onClick={() => setMenuOpen(false)}>{copy.story}</a>
      </nav>
      <CommunityLinks className="header-community" copy={communityCopy} />
      <div className="header-controls">
        <button className="language-toggle" type="button" onClick={changeLanguage} aria-label={copy.languageSwitchLabel}>{copy.languageLabel}</button>
        <button className="menu-toggle" type="button" aria-controls="primary-navigation" aria-expanded={menuOpen} aria-label={menuOpen ? copy.menuCloseLabel : copy.menuOpenLabel} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? copy.closeLabel : copy.menuLabel}</button>
      </div>
    </header>
  )
}
