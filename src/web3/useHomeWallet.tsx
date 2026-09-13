import { useEffect, useRef, useState } from 'react'
import type { Language } from '../content/siteContent'
import { WalletChooser } from '../components/WalletChooser'
import { discoverWalletProviders, type WalletProviderDetail } from './walletProviders'
import { requestSender } from '../airdrop/wallet'

// Homepage connection is account permission only; no sale contract or payment client.
export function useHomeWallet(language: Language) {
  const [account, setAccount] = useState<`0x${string}` | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [providers, setProviders] = useState<WalletProviderDetail[]>([])
  const [selected, setSelected] = useState<WalletProviderDetail | null>(null)
  const pending = useRef(false)
  useEffect(() => discoverWalletProviders(setProviders), [])
  useEffect(() => {
    if (!selected) return
    const provider = selected.provider
    const reset = () => setAccount(null)
    provider.on?.('accountsChanged', reset)
    provider.on?.('chainChanged', reset)
    provider.on?.('disconnect', reset)
    return () => {
      provider.removeListener?.('accountsChanged', reset)
      provider.removeListener?.('chainChanged', reset)
      provider.removeListener?.('disconnect', reset)
    }
  }, [selected])
  const zh = language === 'zh'
  const select = async (wallet: WalletProviderDetail) => {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setMessage('')
    setAccount(null)
    setSelected(wallet)
    try {
      setAccount(await requestSender(wallet.provider, Boolean(account)))
      setOpen(false)
    } catch (error) {
      setMessage(zh && error instanceof Error ? error.message : 'Connection failed. Check your wallet and select BNB Smart Chain.')
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  const walletDialog = open ? <WalletChooser providers={providers} onSelect={select} onClose={() => setOpen(false)} copy={{
    walletHeading: zh ? '连接钱包' : 'CONNECT WALLET',
    walletBody: message || (busy ? (zh ? '请在钱包中确认连接。' : 'Confirm the connection in your wallet.') : (zh ? '选择 BNB Smart Chain 钱包。连接仅获取账户，不发起转账。' : 'Select a BNB Smart Chain wallet. Connecting requests account access only.')),
    close: zh ? '关闭' : 'CLOSE',
    walletMissing: zh ? '未检测到钱包' : 'NO WALLET DETECTED',
    walletMobileHint: zh ? '请在钱包内置浏览器打开官网，或安装浏览器钱包扩展。' : 'Open this site in your wallet browser or install a wallet extension.',
    walletConnectUnavailable: zh ? '可在钱包的已连接网站中管理账户权限。' : 'Manage account permissions in your wallet’s connected sites.',
  }} /> : null
  return { account, openWallet: () => { setMessage(''); setOpen(true) }, walletDialog }
}
