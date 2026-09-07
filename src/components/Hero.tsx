import type { SiteCopy } from '../content/siteContent'
import { projectConfig } from '../config/project'

type Props = { copy: SiteCopy['hero'] }

export function Hero({ copy }: Props) {

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1 id="hero-title"><span>{projectConfig.brand.chineseName}</span><em>{projectConfig.brand.englishName}</em></h1>
        <p className="hero-tagline">{copy.tagline}</p>
        <p className="hero-description">{copy.description}</p>
        <ul className="hero-quick-facts" aria-label={copy.statusLabel}>
          {copy.quickFacts.map((fact) => <li key={fact.label}><span>{fact.label}</span><strong>{fact.value}</strong></li>)}
        </ul>
        <div className="hero-actions"><a className="button button-primary" href="#mechanism">{copy.enterPresale}</a><a className="button button-secondary" href="#community">{copy.brandSignalLabel}</a></div>
      </div>
      <div className="hero-visual" role="img" aria-label={copy.visualLabel}>
        <span className="hero-visual-status" aria-hidden="true">FLAP STOCK</span>
        <p className="ticker" aria-hidden="true">{copy.visualTicker}</p>
        <div className="butterfly-stage" aria-hidden="true"><img src="/flap-stock-avatar.png" alt="" /></div>
      </div>
    </section>
  )
}
