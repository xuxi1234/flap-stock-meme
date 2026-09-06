import type { Address } from 'viem'
import type { SiteCopy } from '../content/siteContent'
import type { ParticipationRecord } from '../web3/participationRecord'

type Props = { copy: SiteCopy['presale']['interaction']; account: Address | null; hasParticipated: boolean; record: ParticipationRecord | null }

export function MyParticipation({ copy, account, hasParticipated, record }: Props) {
  return (
    <section className="my-participation" aria-label={copy.myParticipation}>
      <div className="subsection-title"><span>MY / FLAP</span><h3>{copy.myParticipation}</h3></div>
      {!account ? <p>{copy.noRecord}</p> : (
        <div className="participation-records">
          <article><span>{copy.chainRecord}</span><strong>{hasParticipated ? copy.confirmed : copy.noRecord}</strong>{hasParticipated && <small>{copy.distributionPending}</small>}</article>
          {record && <article><span>{copy.savedRecord}</span><a href={`https://bscscan.com/tx/${record.hash}`} target="_blank" rel="noreferrer"><code>{record.hash}</code></a><small>{copy.submittedAt}: {new Date(record.submittedAt).toLocaleString()}</small></article>}
        </div>
      )}
    </section>
  )
}
