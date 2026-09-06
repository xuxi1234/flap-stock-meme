import type { SiteCopy } from '../content/siteContent'

export function Faq({ copy }: { copy: SiteCopy['faq'] }) {
  return <section className="statement faq-section" aria-label={copy.regionLabel}><p className="eyebrow">{copy.eyebrow}</p><h2>{copy.title}</h2><div className="faq-list">{copy.items.map((item, index) => <details key={item.question} open={index === 0}><summary><span>{String(index + 1).padStart(2, '0')}</span>{item.question}</summary><p>{item.answer}</p></details>)}</div></section>
}
