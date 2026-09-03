import type { SiteCopy } from '../content/siteContent'

type Props = { copy: SiteCopy['roadmap'] }

export function Roadmap({ copy }: Props) {
  return (
    <section className="statement roadmap-section" id="roadmap" aria-label={copy.regionLabel}>
      <p className="eyebrow">{copy.eyebrow}</p>
      <h2>{copy.title}</h2>
      <ol>{copy.phases.map((phase) => <li key={phase.code}><span>{phase.code}</span><h3>{phase.title}</h3><p>{phase.body}</p><small>{phase.status}</small></li>)}</ol>
      <p className="roadmap-caveat" role="note">{copy.caveat}</p>
    </section>
  )
}
