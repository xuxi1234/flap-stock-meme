import type { SiteCopy } from '../content/siteContent'

type Props = { copy: SiteCopy['manifesto'] }

export function Manifesto({ copy }: Props) {
  return (
    <section className="statement manifesto-section" aria-label={copy.regionLabel}>
      <p className="eyebrow">{copy.eyebrow}</p>
      <h2>{copy.title}</h2>
      <p>{copy.body}</p>
    </section>
  )
}
