import type { SiteCopy } from '../content/siteContent'

type Props = { copy: SiteCopy['effect'] }

export function ButterflyEffect({ copy }: Props) {
  return (
    <section className="statement effect-section" id="story" aria-label={copy.regionLabel}>
      <p className="eyebrow">{copy.eyebrow}</p>
      <h2>{copy.title}</h2>
      <p>{copy.body}</p>
      <ol className="effect-grid">
        {copy.steps.map((step) => <li key={step.index}><span>{step.index}</span><h3>{step.title}</h3><p>{step.body}</p></li>)}
      </ol>
    </section>
  )
}
