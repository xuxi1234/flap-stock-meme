import type { SiteCopy } from '../content/siteContent'

export function ParticipationRules({ copy }: { copy: SiteCopy['participationRules'] }) {
  return (
    <section className="statement rules-section" id="rules" aria-label={copy.regionLabel}>
      <p className="eyebrow">{copy.eyebrow}</p>
      <div className="section-heading"><h2>{copy.title}</h2><p>{copy.body}</p></div>
      <div className="rule-grid">
        {copy.cards.map((card) => (
          <article className={card.status === 'pending' ? 'is-pending' : ''} key={card.label}>
            <span>{card.label}</span><strong>{card.value}</strong><p>{card.detail}</p>
            {card.status === 'pending' && <small>{copy.pendingLabel}</small>}
          </article>
        ))}
      </div>
      <div className="rule-notes"><p>{copy.leaderNote}</p><p>{copy.meaningNote}</p></div>
    </section>
  )
}
