import { projectConfig } from '../config/project'
import { communityLogos } from '../config/communityLogos'
import type { SiteCopy } from '../content/siteContent'

type Props = {
  copy: SiteCopy['community']
  className?: string
}

export function CommunityLinks({ copy, className = '' }: Props) {
  const channels = [
    { label: 'QQ', href: projectConfig.community.qq, icon: communityLogos.qq },
    { label: copy.xLabel, href: projectConfig.community.x, icon: communityLogos.x },
    { label: copy.telegramLabel, href: projectConfig.community.telegram, icon: communityLogos.telegram },
    { label: 'DeBox', href: projectConfig.community.debox, icon: communityLogos.debox },
  ]

  return (
    <div className={`community-links ${className}`.trim()} role="group" aria-label={copy.regionLabel}>
      {channels.map(({ label, href, icon }) => (
        <a className="community-link" href={href} key={label} target="_blank" rel="noopener noreferrer" aria-label={label}>
          <img src={icon} alt="" width="28" height="28" />{label !== 'QQ' && <span>{label}</span>}
        </a>
      ))}
    </div>
  )
}
