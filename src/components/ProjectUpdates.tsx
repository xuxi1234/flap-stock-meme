import { useState } from 'react'
import type { SiteCopy } from '../content/siteContent'

export function ProjectUpdates({ copy }: { copy: SiteCopy['updates'] }) {
  const [copied, setCopied] = useState(false)
  const shareUrl = 'https://www.hudiegupiao.com/?utm_source=community&utm_medium=share&utm_campaign=presale'
  const payload = `${copy.shareText}\n${shareUrl}`
  const copyShare = async () => { await navigator.clipboard?.writeText(payload); setCopied(true); window.setTimeout(() => setCopied(false), 1800) }
  const systemShare = async () => {
    if (navigator.share) await navigator.share({ title: 'FLAP STOCK | 蝴蝶股票', text: copy.shareText, url: shareUrl })
    else await copyShare()
  }
  return (
    <section className="statement updates-section" aria-label={copy.regionLabel}>
      <p className="eyebrow">{copy.eyebrow}</p><div className="section-heading"><h2>{copy.title}</h2><p>{copy.body}</p></div>
      <div className="updates-layout"><div className="update-list"><div className="updated-stamp"><span>{copy.updatedLabel}</span><strong>{copy.updatedValue}</strong></div>{copy.items.map((item) => <article key={`${item.date}-${item.title}`}><time>{item.date}</time><div><h3>{item.title}</h3><p>{item.body}</p></div></article>)}</div>
      <aside className="share-panel"><img src="/flap-stock-avatar.png" alt="" /><span>SHARE / FLAP</span><h3>{copy.shareTitle}</h3><p>{copy.shareBody}</p><div><button className="button button-primary" type="button" onClick={() => void systemShare()}>{copy.shareButton}</button><button className="button button-secondary" type="button" onClick={() => void copyShare()}>{copied ? copy.copied : copy.copyButton}</button><a className="text-link" href="/flap-stock-avatar.png" download>{copy.download}</a></div></aside></div>
    </section>
  )
}
