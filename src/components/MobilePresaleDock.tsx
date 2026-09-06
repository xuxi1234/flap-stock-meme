import type { SiteCopy } from '../content/siteContent'
import type { PresaleDisplayStatus } from './Presale'

type Props = { copy: SiteCopy['hero']; status: PresaleDisplayStatus }

export function MobilePresaleDock({ copy, status }: Props) {
  return <aside className={`mobile-presale-dock status-${status}`} aria-label={copy.statusLabel}>
    <span><i aria-hidden="true" />{copy.mobilePresaleMeta}<small>{copy.mobileStatus[status]}</small></span>
    <a href="#presale" aria-label={copy.mobilePresaleLabel}><strong>{status === 'live' ? '0.05 BNB' : copy.mobileStatus[status]}</strong><small>{copy.enterPresale}</small></a>
  </aside>
}
