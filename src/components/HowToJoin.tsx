import type { SiteCopy } from '../content/siteContent'

type Props = { copy: SiteCopy['howTo'] }

export function HowToJoin({ copy }: Props) {
  return (
    <section className="statement participation-section" aria-label={copy.regionLabel}>
      <p className="eyebrow">{copy.eyebrow}</p>
      <h2>{copy.title}</h2>
      <ol className="participation-grid">{copy.steps.map((step) => <li key={step.index}><span>{step.index}</span><h3>{step.title}</h3><p>{step.body}</p></li>)}</ol>
    </section>
  )
}
