import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPublicClient, createWalletClient, custom, fallback, http, type Address, type Hash } from 'viem'
import { bsc } from 'viem/chains'
import { projectConfig } from '../config/project'
import { siteContent } from '../content/siteContent'
import { deadlineAdminError, readDeadlineAdminState, submitDeadlineUpdate, type DeadlineUpdateStage } from '../web3/presaleAdmin'
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
  const [stage, setStage] = useState<DeadlineUpdateStage | 'connecting' | 'confirming' | null>(null)
  const inFlight = useRef(false)
  const accountRef = useRef<Address | null>(null)
  const synced = state?.endTime === BigInt(projectConfig.presale.websiteDeadline)
  const isOwner = account?.toLowerCase() === state?.owner.toLowerCase()
    && account?.toLowerCase() === projectConfig.presale.adminAddress.toLowerCase()

  const refresh = useCallback(async () => {
    try {
      const next = await readDeadlineAdminState(client)
      setState(next)
      setMessage(next.endTime === BigInt(projectConfig.presale.websiteDeadline) ? '链上截止时间已同步，无需再次提交。' : accountRef.current?.toLowerCase() === next.owner.toLowerCase() ? '管理员已连接。点击紫色按钮后，请在钱包中确认截止时间修改。' : accountRef.current ? '当前连接地址不是管理员，请切换钱包后重新连接。' : '请连接管理员钱包，确认本次截止时间修改。')
      return next
    } catch (error) { setMessage(`读取链上状态失败：${deadlineAdminError(error)}`); return null }
  }, [client])
  useEffect(() => discoverWalletProviders(setProviders), [])
  useEffect(() => { void refresh() }, [refresh])

  const connect = async (detail: WalletProviderDetail) => {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); setStage('connecting')
    setChooser(false)
    try {
      setMessage(`正在连接 ${detail.info.name}，请在钱包中确认连接请求。`)
      const wallet = createWalletClient({ chain: bsc, transport: custom(detail.provider) })
      const [address] = await wallet.requestAddresses()
      accountRef.current = address ?? null
      setAccount(address ?? null); setSelected(detail)
      await refresh()
    } catch (error) { setMessage(`连接未完成：${deadlineAdminError(error)}`) }
    finally { inFlight.current = false; setBusy(false); setStage(null) }
  }
  const update = async () => {
    if (!selected || inFlight.current || synced || !isOwner) return
    inFlight.current = true; setBusy(true); setHash(null)
    let sent: Hash | null = null
    try {
      setMessage('正在检查权限并模拟修改，随后请在钱包确认。')
      const wallet = createWalletClient({ chain: bsc, transport: custom(selected.provider) })
      sent = await submitDeadlineUpdate(client, wallet, next => {
        setStage(next)
        setMessage({
          checking: '已收到点击：正在核对管理员和链上截止时间…',
          switching: '请在钱包中切换至 BNB Chain（BSC 主网）。',
          simulating: '正在预检查修改交易，尚未发送钱包签名请求…',
          wallet: `等待钱包确认：请求已发送给 ${selected.info.name}。若没有弹出窗口，请点击浏览器右上角钱包图标，查看待处理请求。`,
        }[next])
      })
      if (!sent) { await refresh(); return }
      setHash(sent); setStage('confirming'); setMessage('修改交易已发送，等待链上确认…')
      const receipt = await client.waitForTransactionReceipt({ hash: sent })
      if (receipt.status !== 'success') throw new Error('reverted')
      setHash(receipt.transactionHash)
      const next = await refresh()
      if (next && next.endTime !== BigInt(projectConfig.presale.websiteDeadline)) setMessage('交易已确认，但截止时间尚未与目标一致，请重新检查。')
    } catch (error) {
      setMessage(sent ? `交易已发送，请先查看交易记录，勿重复提交。${deadlineAdminError(error)}` : `修改未完成：${deadlineAdminError(error)}`)
    } finally { inFlight.current = false; setBusy(false); setStage(null) }
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
        {!synced && <button className="button button-secondary" type="button" disabled={busy} onClick={() => setChooser(true)}>{account ? '重新连接钱包' : '连接管理员钱包'}</button>}
        <button className="button button-primary" type="button" disabled={busy || !isOwner || synced || !state || Boolean(hash)} onClick={() => void update()}>{synced ? '链上已同步' : stage === 'wallet' ? '等待钱包确认' : stage === 'confirming' ? '等待链上确认' : busy ? '正在处理…' : '确认同步至上述截止时间'}</button>
        <button className="button button-secondary" type="button" disabled={busy} onClick={() => void refresh()}>重新检查</button>
      </div>
      <p role="status">{message}</p>
      {hash && <p style={{ overflowWrap: 'anywhere' }}><a href={`https://bscscan.com/tx/${hash}`} target="_blank" rel="noreferrer">查看修改交易：{hash}</a></p>}
      <a href="/#presale">返回私募页面</a>
    </section>
    {chooser && <WalletChooser copy={siteContent.zh.presale.interaction} providers={providers} onClose={() => setChooser(false)} onSelect={detail => void connect(detail)} />}
  </main>
}
