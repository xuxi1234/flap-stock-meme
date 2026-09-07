import type { ReactNode } from 'react'
import type { SiteCopy } from '../content/siteContent'
import { projectConfig } from '../config/project'
import { PendingAction } from './PendingAction'

type Props = { copy: SiteCopy['presale']; action?: ReactNode; presaleEnabled?: boolean }

export function PresaleConsole({
  copy,
  action,
  presaleEnabled = Boolean(projectConfig.presale.contractAddress && projectConfig.presale.purchaseUrl),
}: Props) {
  return (
    <section className="statement presale-section" id="presale" aria-label={copy.regionLabel}>
      <p className="eyebrow">{copy.eyebrow}</p>
      <h2>{copy.title}</h2>
      <p>{copy.body}</p>
      <ul>{copy.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
      {action ?? <PendingAction label={presaleEnabled ? copy.actionLabel : copy.unavailable} href={presaleEnabled ? projectConfig.presale.purchaseUrl : null} pendingLabel={copy.pendingLabel} />}
    </section>
  )
}
