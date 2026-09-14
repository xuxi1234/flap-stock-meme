import { projectConfig } from '../config/project'
import type { SiteCopy } from '../content/siteContent'

type Props = { copy: SiteCopy['ticker'] }

export function TickerStrip({ copy }: Props) {
  return (
    <section className="terminal-strip" aria-label={copy.sectionLabel}>
      <p><span>{copy.symbolLabel}</span><strong>蝴蝶股票</strong></p>
      <p><span>{copy.chainLabel}</span><strong>BSC</strong></p>
      <p><span>{copy.statusLabel}</span><strong><a href={`https://bscscan.com/token/${projectConfig.token.contractAddress}`} target="_blank" rel="noreferrer" title={projectConfig.token.contractAddress ?? ''}>{projectConfig.token.contractAddress?.slice(0, 8)}…{projectConfig.token.contractAddress?.slice(-6)} ↗</a></strong></p>
    </section>
  )
}
