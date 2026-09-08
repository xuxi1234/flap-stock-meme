import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPublicClient, createWalletClient, custom, fallback, http, type Address, type Hash } from 'viem'
import { bsc } from 'viem/chains'
import { projectConfig } from '../config/project'
import { siteContent } from '../content/siteContent'
import { readDeadlineAdminState, submitDeadlineUpdate } from '../web3/presaleAdmin'
import { discoverWalletProviders, type WalletProviderDetail } from '../web3/walletProviders'
import { WalletChooser } from './WalletChooser'

const beijingTime = (seconds: bigint) => new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
}).format(new Date(Number(seconds) * 1000))

export function PresaleDeadlineAdmin() {
  const client = useMemo(() => createPublicClient({ chain: bsc, transport: fallback([
    http('https://bsc-rpc.publicnode.com', { timeout: 4000, retryCount: 0 }),
    http('https://bsc-dataseed.bnbchain.org', { timeout: 4000, retryCount: 0 }),
  ], { retryCount: 0 }) }), [])
  const [state, setState] = useState<Awaited<ReturnType<typeof readDeadlineAdminState>> | null>(null)
  const [providers, setProviders] = useState<WalletProviderDetail[]>([])
  const [selected, setSelected] = useState<WalletProviderDetail | null>(null)
  const [account, setAccount] = useState<Address | null>(null)
  const [chooser, setChooser] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('正在读取链上截止时间…')
  const [hash, setHash] = useState<Hash | null>(null)
  const inFlight = useRef(false)
  const synced = state?.endTime === BigInt(projectConfig.presale.websiteDeadline)
  const isOwner = account?.toLowerCase() === state?.owner.toLowerCase()
    && account?.toLowerCase() === projectConfig.presale.adminAddress.toLowerCase()

  const refresh = useCallback(async () => {
    try {
      const next = await readDeadlineAdminState(client)
      setState(next)
      setMessage(next.endTime === BigInt(projectConfig.presale.websiteDeadline) ? '链上截止时间已同步，无需再次提交。' : '请连接管理员钱包，确认本次截止时间修改。')
      return next
    } catch { setMessage('暂时无法读取链上状态，请稍后重新检查。'); return null }
  }, [client])
  useEffect(() => discoverWalletProviders(setProviders), [])
  useEffect(() => { void refresh() }, [refresh])

  const connect = async (detail: WalletProviderDetail) => {
    setChooser(false)
    try {
      const wallet = createWalletClient({ chain: bsc, transport: custom(detail.provider) })
      const [address] = await wallet.requestAddresses()
      setAccount(address ?? null); setSelected(detail)
      await refresh()
    } catch { setMessage('钱包连接未完成，请重试。') }
  }
  const update = async () => {
    if (!selected || inFlight.current || synced || !isOwner) return
    inFlight.current = true; setBusy(true); setHash(null)
    let sent: Hash | null = null
    try {
      setMessage('正在检查权限并模拟修改，随后请在钱包确认。')
      const wallet = createWalletClient({ chain: bsc, transport: custom(selected.provider) })
      sent = await submitDeadlineUpdate(client, wallet)
      if (!sent) { await refresh(); return }
      setHash(sent); setMessage('修改交易已发送，等待链上确认…')
      const receipt = await client.waitForTransactionReceipt({ hash: sent })
      if (receipt.status !== 'success') throw new Error('reverted')
      setHash(receipt.transactionHash)
      const next = await refresh()
      if (next && next.endTime !== BigInt(projectConfig.presale.websiteDeadline)) setMessage('交易已确认，但截止时间尚未与目标一致，请重新检查。')
    } catch {
      setMessage(sent ? '交易已发送，暂时无法确认最终结果。请先查看交易记录并重新检查，勿重复提交。' : '修改未完成。请确认管理员钱包、BSC 主网及网络费余额后重试。')
    } finally { inFlight.current = false; setBusy(false) }
  }
  return <main className="site-shell">
    <section className="statement" style={{ marginTop: 24 }} aria-label="私募截止时间管理">
      <p className="eyebrow">PRIVATE SALE / ADMIN</p>
      <h2>同步私募截止时间</h2>
      <p><strong>目标：{projectConfig.presale.deadlineZh}</strong></p>
      <p>当前链上：{state ? `${beijingTime(state.endTime)}（北京时间）` : '读取中…'}</p>
      <p>本次仅调整截止时间，不转入私募金额；网络费由钱包显示。</p>
      <p style={{ overflowWrap: 'anywhere' }}>合约：{projectConfig.presale.contractAddress}</p>
      <p style={{ overflowWrap: 'anywhere' }}>管理员：{state?.owner ?? projectConfig.presale.adminAddress}</p>
      {account && <p style={{ overflowWrap: 'anywhere' }}>已连接：{account}{!isOwner && '（请切换至管理员钱包后重新连接）'}</p>}
      <div className="hero-actions">
        {!synced && <button className="button button-secondary" type="button" disabled={busy} onClick={() => setChooser(true)}>连接管理员钱包</button>}
        <button className="button button-primary" type="button" disabled={busy || !isOwner || synced || !state || Boolean(hash)} onClick={() => void update()}>{synced ? '链上已同步' : busy ? '处理中…' : '确认修改为 06:59:59'}</button>
        <button className="button button-secondary" type="button" disabled={busy} onClick={() => void refresh()}>重新检查</button>
      </div>
      <p role="status">{message}</p>
      {hash && <p style={{ overflowWrap: 'anywhere' }}><a href={`https://bscscan.com/tx/${hash}`} target="_blank" rel="noreferrer">查看修改交易：{hash}</a></p>}
      <a href="/#presale">返回私募页面</a>
    </section>
    {chooser && <WalletChooser copy={siteContent.zh.presale.interaction} providers={providers} onClose={() => setChooser(false)} onSelect={detail => void connect(detail)} />}
  </main>
}
