import type { SiteCopy } from '../content/siteContent'

type Props = { copy: SiteCopy['ticker'] }

export function TickerStrip({ copy }: Props) {
  return (
    <section className="terminal-strip" aria-label={copy.sectionLabel}>
      <p><span>{copy.symbolLabel}</span><strong>$FLAP</strong></p>
      <p><span>{copy.chainLabel}</span><strong>BSC</strong></p>
      <p><span>{copy.statusLabel}</span><strong>{copy.sectionLabel === 'FLAP STOCK 项目详情' ? '待公布' : 'NOT ANNOUNCED'}</strong></p>
    </section>
  )
}
