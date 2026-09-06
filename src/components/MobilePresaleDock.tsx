import type { SiteCopy } from '../content/siteContent'

type Props = { copy: SiteCopy['hero'] }

export function MobilePresaleDock({ copy }: Props) {
  return (
    <aside className="mobile-presale-dock" aria-label={copy.statusLabel}>
      <span><i aria-hidden="true" />{copy.mobilePresaleMeta}</span>
      <a href="#presale" aria-label={copy.mobilePresaleLabel}>
        <strong>0.05 BNB</strong>
        <small>{copy.enterPresale}</small>
      </a>
    </aside>
  )
}
