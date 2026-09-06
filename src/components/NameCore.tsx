import type { SiteCopy } from '../content/siteContent'

type Props = { copy: SiteCopy['nameCore'] }

export function NameCore({ copy }: Props) {
  return (
    <section className="statement name-core-section" id="story" aria-label={copy.regionLabel}>
      <p className="eyebrow">{copy.eyebrow}</p>
      <h2>{copy.title}</h2>
      <div className="name-core-grid">
        {copy.cards.map((card) => <article key={card.glyph}><strong className="name-core-glyph">{card.glyph}</strong><h3>{card.title}</h3><p>{card.body}</p></article>)}
      </div>
      <p className="name-core-disclaimer" role="note">{copy.disclaimer}</p>
    </section>
  )
}
