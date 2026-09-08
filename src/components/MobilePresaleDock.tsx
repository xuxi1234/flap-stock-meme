import type { SiteCopy } from '../content/siteContent'
import { projectConfig } from '../config/project'
import type { PresaleDisplayStatus } from './Presale'

type Props = { account: `0x${string}` | null; onWalletClick: () => void; language: 'zh' | 'en'; copy: SiteCopy['hero']; status: PresaleDisplayStatus }

export function MobilePresaleDock({ account, onWalletClick, language, copy, status }: Props) {
  const zh = language === 'zh'
  if (!projectConfig.presale.websiteOpen) return <aside className="mobile-presale-dock status-unavailable" aria-label={zh ? '私募通知' : 'Private sale notice'}>
    <span>{zh ? '私募暂未开放' : 'PRIVATE SALE NOT OPEN'}<small>{zh ? '敬请等待官方通知' : 'Await the official announcement'}</small></span>
    <a href="#community"><strong>{zh ? '关注社区' : 'COMMUNITY'}</strong><small>{zh ? '获取官方动态' : 'OFFICIAL UPDATES'}</small></a>
  </aside>

  return <aside className={`mobile-presale-dock status-${status}`} aria-label={copy.mobilePresaleLabel}>
    <span>{copy.mobilePresaleMeta}<small role="status">{copy.mobileStatus[status]}</small></span>
    <a href="#presale" onClick={() => { if (!account) onWalletClick() }}>
      <strong>{account ? `${projectConfig.presale.priceBnb} BNB` : zh ? '连接钱包' : 'CONNECT WALLET'}</strong>
      <small>{account ? copy.enterPresale : zh ? '查看私募' : 'VIEW PRIVATE SALE'}</small>
    </a>
  </aside>
}
