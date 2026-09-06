import { projectConfig } from '../config/project'
import type { SiteCopy } from '../content/siteContent'
import { CopyControl } from './CopyControl'

export function PublicProof({ copy }: { copy: SiteCopy['publicProof'] }) {
  const items = [
    { label: copy.presaleLabel, value: projectConfig.presale.contractAddress, note: copy.presaleNote, scan: true },
    { label: copy.tokenLabel, value: projectConfig.token.contractAddress, note: copy.tokenNote, scan: true },
    { label: copy.recipientLabel, value: projectConfig.presale.recipientAddress, note: copy.recipientNote, scan: true },
    { label: copy.adminLabel, value: projectConfig.presale.adminAddress, note: copy.adminNote, scan: true },
    { label: copy.platformLabel, value: copy.platformValue, note: copy.platformNote, scan: false },
    { label: copy.communityLabel, value: null, note: copy.communityNote, scan: false },
  ]
  return (
    <section className="statement proof-section" id="proof" aria-label={copy.regionLabel}>
      <p className="eyebrow">{copy.eyebrow}</p><div className="section-heading"><h2>{copy.title}</h2><p>{copy.body}</p></div>
      <div className="proof-grid">{items.map((item) => <article key={item.label} className={!item.value ? 'is-pending' : ''}>
        <span>{item.label}</span><strong>{item.value ?? copy.pending}</strong><p>{item.note}</p>
        {item.value && item.value.startsWith('0x') && <div className="proof-actions"><CopyControl value={item.value} label={copy.copy} copiedLabel={copy.copied} />{item.scan && <a href={`https://bscscan.com/address/${item.value}`} target="_blank" rel="noreferrer">{copy.openExplorer}</a>}</div>}
      </article>)}</div>
    </section>
  )
}
