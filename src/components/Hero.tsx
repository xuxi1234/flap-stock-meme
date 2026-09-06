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
        <h1 id="hero-title"><span>{projectConfig.brand.chineseName}</span><em>{projectConfig.brand.englishName}</em></h1>
        <p className="hero-tagline">{copy.tagline}</p>
        <p className="hero-description">{copy.description}</p>
        <aside className="hero-signal" aria-label={copy.brandSignalLabel}>
          <span>{copy.brandSignalLabel}</span>
          <strong>{copy.brandSignalValue}</strong>
          <small>{copy.safetyLabel}</small>
        </aside>
        <div className="hero-actions">
          <a className="button button-primary" href="#story">{copy.explore}</a>
          <PendingAction label={copy.enterPresale} href={presaleEnabled ? projectConfig.presale.purchaseUrl : null} className="button-secondary" pendingLabel={copy.presalePendingLabel} />
        </div>
      </div>
      <div className="hero-visual" role="img" aria-label={copy.visualLabel}>
        <p className="ticker" aria-hidden="true">$FLAP · $FLAP · $FLAP</p>
        <img src="/flap-stock-logo.png" alt="" />
      </div>
    </section>
  )
}
