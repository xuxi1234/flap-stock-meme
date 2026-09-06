import type { EIP1193Provider } from 'viem'

export type WalletProviderInfo = {
  uuid: string
  name: string
  icon: string
  rdns: string
}

export type WalletProviderDetail = {
  info: WalletProviderInfo
  provider: EIP1193Provider
}

export type Eip6963AnnounceEvent = CustomEvent<WalletProviderDetail>

export function mergeWalletProviders(details: WalletProviderDetail[], legacy?: EIP1193Provider): WalletProviderDetail[] {
  const unique: WalletProviderDetail[] = []
  const uuids = new Set<string>()
  const providers = new Set<EIP1193Provider>()

  details.forEach((detail) => {
    if (!detail?.info?.uuid || !detail.provider || uuids.has(detail.info.uuid)) return
    uuids.add(detail.info.uuid)
    providers.add(detail.provider)
    unique.push(detail)
  })

  if (legacy && !providers.has(legacy)) {
    unique.push({
      info: { uuid: 'legacy-injected', name: 'Browser Wallet', icon: '', rdns: 'injected' },
      provider: legacy,
    })
  }

  return unique
}

export function discoverWalletProviders(onChange: (providers: WalletProviderDetail[]) => void) {
  const announced: WalletProviderDetail[] = []
  const legacy = (window as Window & { ethereum?: EIP1193Provider }).ethereum

  const publish = () => onChange(mergeWalletProviders(announced, legacy))
  const handleAnnouncement = (event: Event) => {
    const detail = (event as Eip6963AnnounceEvent).detail
    if (!detail?.provider || !detail.info) return
    announced.push(detail)
    publish()
  }

  window.addEventListener('eip6963:announceProvider', handleAnnouncement)
  window.dispatchEvent(new Event('eip6963:requestProvider'))
  publish()

  return () => window.removeEventListener('eip6963:announceProvider', handleAnnouncement)
}
