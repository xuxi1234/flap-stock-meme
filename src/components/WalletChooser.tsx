import type { SiteCopy } from '../content/siteContent'
import type { WalletProviderDetail } from '../web3/walletProviders'

type Props = { copy: SiteCopy['presale']['interaction']; providers: WalletProviderDetail[]; onSelect: (wallet: WalletProviderDetail) => void; onClose: () => void }

export function WalletChooser({ copy, providers, onSelect, onClose }: Props) {
  return (
    <div className="wallet-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}>
      <div className="wallet-dialog" role="dialog" aria-modal="true" aria-label={copy.walletHeading}>
        <div className="wallet-dialog-head"><div><small>BSC / 56</small><h3>{copy.walletHeading}</h3></div><button type="button" onClick={onClose}>{copy.close}</button></div>
        <p>{copy.walletBody}</p>
        {providers.length ? <div className="wallet-options">{providers.map((wallet) => (
          <button type="button" key={wallet.info.uuid} onClick={() => onSelect(wallet)}>
            {wallet.info.icon && <img src={wallet.info.icon} alt="" />}
            <span><strong>{wallet.info.name}</strong><small>{wallet.info.rdns}</small></span>
          </button>
        ))}</div> : <div className="wallet-empty"><strong>{copy.walletMissing}</strong><p>{copy.walletMobileHint}</p></div>}
        <p className="wallet-qr-note">{copy.walletConnectUnavailable}</p>
      </div>
    </div>
  )
}
