import type { SiteCopy } from '../content/siteContent'
import type { PresaleDisplayStatus } from './Presale'

type Props = { account: `0x${string}` | null; onWalletClick: () => void; language: 'zh' | 'en'; copy: SiteCopy['hero']; status: PresaleDisplayStatus }

export function MobilePresaleDock({ copy, status, account, onWalletClick, language }: Props) {
  return <aside className={`mobile-presale-dock status-${status}`} aria-label={copy.statusLabel}>
    <span><i aria-hidden="true" />{copy.mobilePresaleMeta}<small>{copy.mobileStatus[status]}</small></span>
    <a href="#presale" onClick={event => { event.preventDefault(); onWalletClick() }} aria-label={!account ? (language === 'zh' ? '连接钱包' : 'CONNECT WALLET') : copy.mobilePresaleLabel}><strong>{!account ? (language === 'zh' ? '连接钱包' : 'CONNECT WALLET') : status === 'live' ? '0.05 BNB' : copy.mobileStatus[status]}</strong><small>{copy.enterPresale}</small></a>
  </aside>
}
