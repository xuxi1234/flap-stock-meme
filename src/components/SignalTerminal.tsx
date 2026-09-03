import type { SiteCopy } from '../content/siteContent'

type Props = { copy: SiteCopy['signal'] }

export function SignalTerminal({ copy }: Props) {
  return (
    <section className="statement signal-section" id="signal" aria-label={copy.regionLabel}>
      <p className="eyebrow">{copy.eyebrow}</p>
      <h2>{copy.title}</h2>
      <div className="signal-grid">
        {copy.metrics.map((metric) => <article key={metric.label}><p>{metric.label}</p><strong>{metric.value}</strong><span>{metric.trend}</span><small>{copy.disclaimer}</small></article>)}
      </div>
    </section>
  )
}
