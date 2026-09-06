import type { SiteCopy } from '../content/siteContent'
import { projectConfig } from '../config/project'
import { PendingAction } from './PendingAction'

type Props = { copy: SiteCopy['hero'] }

export function Hero({ copy }: Props) {
  const presaleEnabled = Boolean(projectConfig.presale.contractAddress && projectConfig.presale.purchaseUrl)

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="eyebrow">{copy.eyebrow} · #{projectConfig.brand.symbol}</p>
        <p className="hero-live"><span aria-hidden="true" />{copy.statusLabel}</p>
        <h1 id="hero-title"><span>{projectConfig.brand.chineseName}</span><em>{projectConfig.brand.englishName}</em></h1>
        <p className="hero-tagline">{copy.tagline}</p>
        <p className="hero-description">{copy.description}</p>
        <ul className="hero-quick-facts" aria-label={copy.statusLabel}>
          {copy.quickFacts.map((fact) => <li key={fact.label}><span>{fact.label}</span><strong>{fact.value}</strong></li>)}
        </ul>
        <aside className="hero-signal" aria-label={copy.brandSignalLabel}>
          <span>{copy.brandSignalLabel}</span>
          <strong>{copy.brandSignalValue}</strong>
          <small>{copy.safetyLabel}</small>
        </aside>
        <div className="hero-actions">
          <PendingAction label={copy.enterPresale} href={presaleEnabled ? projectConfig.presale.purchaseUrl : null} className="button-primary" pendingLabel={copy.presalePendingLabel} />
          <a className="button button-secondary" href="#story">{copy.explore}</a>
        </div>
      </div>
      <div className="hero-visual" role="img" aria-label={copy.visualLabel}>
        <div className="hero-orbit" aria-hidden="true"><span /><span /><span /></div>
        <span className="hero-visual-status" aria-hidden="true">LIVE · BSC / 56</span>
        <p className="ticker" aria-hidden="true">$FLAP · $FLAP · $FLAP</p>
        <img src="/flap-stock-logo.png" alt="" />
      </div>
    </section>
  )
}
