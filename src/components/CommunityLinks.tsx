import { projectConfig } from '../config/project'
import type { SiteCopy } from '../content/siteContent'

type Props = {
  copy: SiteCopy['community']
  className?: string
}

export function CommunityLinks({ copy, className = '' }: Props) {
  const channels = [
    { label: copy.xLabel, href: projectConfig.community.x, pendingLabel: copy.xPendingLabel },
    { label: copy.telegramLabel, href: projectConfig.community.telegram, pendingLabel: copy.telegramPendingLabel },
  ]

  return (
    <div className={`community-links ${className}`.trim()} role="group" aria-label={copy.regionLabel}>
      {channels.map(({ label, href, pendingLabel }) => href ? (
        <a className="community-link" href={href} key={label} rel="noreferrer">{label}</a>
      ) : (
        <button className="community-link" disabled key={label} type="button" aria-label={pendingLabel}>
          <span>{label}</span>
          <small>{copy.comingSoon}</small>
        </button>
      ))}
    </div>
  )
}
