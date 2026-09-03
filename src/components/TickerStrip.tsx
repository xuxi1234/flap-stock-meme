import type { SiteCopy } from '../content/siteContent'

type Props = { copy: SiteCopy['ticker'] }

export function TickerStrip({ copy }: Props) {
  return (
    <section className="terminal-strip" aria-label={copy.sectionLabel}>
      <p><span>{copy.symbolLabel}</span><strong>$FLAP</strong></p>
      <p><span>{copy.chainLabel}</span><strong>BSC</strong></p>
      <p><span>{copy.priceLabel}</span><strong>0.05 BNB</strong></p>
      <p><span>{copy.capacityLabel}</span><strong>10,000 SEATS</strong></p>
      <p><span>{copy.statusLabel}</span><strong>BUTTERFLY EFFECT</strong></p>
    </section>
  )
}
