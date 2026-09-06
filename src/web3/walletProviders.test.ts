import { describe, expect, it } from 'vitest'
import type { EIP1193Provider } from 'viem'
import { mergeWalletProviders, type WalletProviderDetail } from './walletProviders'

const provider = (id: string) => ({ request: async () => id }) as unknown as EIP1193Provider

describe('wallet provider discovery', () => {
  it('deduplicates repeated EIP-6963 announcements by uuid while keeping wallet metadata', () => {
    const first: WalletProviderDetail = {
      info: { uuid: 'wallet-1', name: 'MetaMask', icon: 'data:image/svg+xml;base64,AA==', rdns: 'io.metamask' },
      provider: provider('first'),
    }
    const repeated = { ...first, provider: provider('second') }

    expect(mergeWalletProviders([first, repeated])).toEqual([first])
  })

  it('adds the legacy injected wallet only when no matching EIP-6963 provider exists', () => {
    const legacy = provider('legacy')
    const announced: WalletProviderDetail = {
      info: { uuid: 'wallet-1', name: 'Browser Wallet', icon: '', rdns: 'com.wallet' },
      provider: legacy,
    }

    expect(mergeWalletProviders([announced], legacy)).toEqual([announced])
    expect(mergeWalletProviders([], legacy)).toEqual([{
      info: { uuid: 'legacy-injected', name: 'Browser Wallet', icon: '', rdns: 'injected' },
      provider: legacy,
    }])
  })
})
