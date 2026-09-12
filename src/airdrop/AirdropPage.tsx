import { useEffect, useMemo, useRef, useState } from 'react'
import { createPublicClient, erc20Abi, fallback, formatUnits, http, isAddress, type Address } from 'viem'
import { bsc } from 'viem/chains'
import { discoverWalletProviders, type WalletProviderDetail } from '../web3/walletProviders'
import { amountText, countValue, csvText, parseRecipients, randomRecipients, splitPresale, units } from './math'
import LiveSendPanel from './LiveSendPanel'
import { requestSender } from './wallet'
import './airdrop.css'

type Mode = 'random' | 'import' | 'presale'
type Token = { address: Address; name: string; symbol: string; decimals: number }
type Row = { address: string; amount: string; group: string }
type Plan = { rows: Row[]; total: string; remainder: string; mode: Mode; token: string; decimals: number; created: string }
const initialContract = '0x4b112e1ed0c0cb332d2b39e5dae3bba882f67777'
const client = createPublicClient({ chain: bsc, transport: fallback([http('/api/swap-rpc', { timeout: 16000, retryCount: 0 }), http('https://bsc-dataseed.bnbchain.org', { timeout: 8000, retryCount: 0 })]) })
const short = (value: string) => value.slice(0, 7) + '…' + value.slice(-6)
const number = (value: string) => { const [a, b] = value.split('.'); return a.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (b ? '.' + b : '') }
function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    drop: <><path d="m12 3 9 6-9 6-9-6 9-6Z"/><path d="m3 13 9 6 9-6M3 17l9 6 9-6"/></>,
    wallet: <><rect x="3" y="5" width="18" height="15" rx="3"/><path d="M16 10h5v5h-5zM5 5V3h13"/></>,
    arrow: <><path d="M4 12h16m-6-6 6 6-6 6"/></>,
    file: <><path d="M14 3H5v18h14V8l-5-5Z M14 3v6h5M8 13h8M8 17h6"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    settings: <><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/></>,
    link: <><path d="m9 15 6-6M8 16l-2 2a4 4 0 0 1-5-5l5-5a4 4 0 0 1 5 0M16 8l2-2a4 4 0 0 1 5 5l-5 5a4 4 0 0 1-5 0"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.drop}</svg>
}
function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 500)
}
export default function AirdropPage() {
  const [mode, setMode] = useState<Mode>('random')
  const [contract, setContract] = useState(initialContract)
  const [token, setToken] = useState<Token | null>(null)
  const [loading, setLoading] = useState(false)
  const [readError, setReadError] = useState('')
  const [perAddress, setPerAddress] = useState('7')
  const [count, setCount] = useState('200')
  const [total, setTotal] = useState('')
  const [largeList, setLargeList] = useState('')
  const [smallList, setSmallList] = useState('')
  const [list, setList] = useState('')
  const [providers, setProviders] = useState<WalletProviderDetail[]>([])
  const [walletMenu, setWalletMenu] = useState(false)
  const [wallet, setWallet] = useState('')
  const [activeProvider, setActiveProvider] = useState<WalletProviderDetail | null>(null)
  const [balance, setBalance] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [message, setMessage] = useState('')
  const [plan, setPlan] = useState<Plan | null>(null)
  const [page, setPage] = useState(0)
  const readVersion = useRef(0)
  const resultRef = useRef<HTMLElement>(null)
  const decimals = token?.decimals ?? 18
  const parsed = useMemo(() => parseRecipients(list), [list])
  const large = useMemo(() => parseRecipients(largeList), [largeList])
  const small = useMemo(() => parseRecipients(smallList), [smallList])
  const overlap = large.addresses.filter(a => small.addresses.includes(a)).length
  useEffect(() => discoverWalletProviders(setProviders), [])
  useEffect(() => { document.title = '蝴蝶空投 · 批量分发与私募配比'; document.body.classList.add('airdrop-body'); return () => document.body.classList.remove('airdrop-body') }, [])
  async function readToken(address = contract) {
    const version = ++readVersion.current
    setToken(null); setBalance(null); setReadError('')
    if (!isAddress(address)) { setReadError('请输入完整的 BSC 合约地址。'); return }
    setLoading(true)
    try {
      const [name, symbol, precision] = await Promise.all([
        client.readContract({ address, abi: erc20Abi, functionName: 'name' }),
        client.readContract({ address, abi: erc20Abi, functionName: 'symbol' }),
        client.readContract({ address, abi: erc20Abi, functionName: 'decimals' }),
      ])
      if (version !== readVersion.current) return
      if (precision > 36) throw Error('precision')
      setToken({ address, name, symbol, decimals: precision })
    } catch { if (version === readVersion.current) setReadError('暂未读取到链上资料。请检查合约或重试；当前计算采用 18 位预览精度。') }
    finally { if (version === readVersion.current) setLoading(false) }
  }
  useEffect(() => { void readToken(initialContract); return () => { readVersion.current++ } }, [])
  useEffect(() => {
    let active = true
    setBalance(null)
    if (wallet && token) client.readContract({ address: token.address, abi: erc20Abi, functionName: 'balanceOf', args: [wallet as Address] }).then(v => { if (active) setBalance(formatUnits(v, token.decimals)) }).catch(() => { if (active) setBalance(null) })
    return () => { active = false }
  }, [wallet, token])
  useEffect(() => {
    if (!activeProvider) return
    const { provider } = activeProvider
    const changed = () => { setWallet(''); setBalance(null); setWalletMenu(true); setMessage('钱包账户或网络已变化，请重新连接并核对发送钱包。') }
    provider.on('accountsChanged', changed); provider.on('chainChanged', changed)
    return () => { provider.removeListener('accountsChanged', changed); provider.removeListener('chainChanged', changed) }
  }, [activeProvider])
  async function connect(detail: WalletProviderDetail, reselect = false) {
    if (connecting) return
    setConnecting(true); setMessage(''); setWallet(''); setBalance(null)
    try {
      const account = await requestSender(detail.provider, reselect)
      setWallet(account); setActiveProvider(detail); setMessage(''); setWalletMenu(false)
    } catch (error) { setMessage((error as Error).message); setWalletMenu(true) }
    finally { setConnecting(false) }
  }
  const calc = useMemo(() => {
    try {
      if (mode === 'presale') { const split = splitPresale(total, decimals); return { ...split, count: 511, total: amountText(split.allocated, decimals), error: '' } }
      const n = mode === 'random' ? countValue(count) : parsed.addresses.length
      const value = units(perAddress, decimals)
      if (!n || n > 2000) throw Error('请导入 1–2000 个有效地址。')
      return { count: n, total: amountText(value * BigInt(n), decimals), error: '', small: 0n, large: 0n, remainder: 0n }
    } catch (e) { return { count: mode === 'presale' ? 511 : 0, total: '—', error: (e as Error).message, small: 0n, large: 0n, remainder: 0n } }
  }, [mode, total, decimals, perAddress, count, parsed])
  const configKey = JSON.stringify([mode, contract, decimals, perAddress, count, total, list, largeList, smallList])
  useEffect(() => { setPlan(null); setPage(0); setMessage('') }, [configKey])
  function validateList(value: ReturnType<typeof parseRecipients>, expected?: number) {
    if (value.errors.length) throw Error(`第 ${value.errors.slice(0, 6).join('、')} 行地址无效，请修正。`)
    if (value.duplicates.length) throw Error(`存在 ${value.duplicates.length} 行重复地址，请核对并删除重复行。`)
    if (expected && value.addresses.length !== expected) throw Error(`本档须有 ${expected} 个地址，目前 ${value.addresses.length} 个。`)
  }
  function generate() {
    setMessage('')
    try {
      if (!isAddress(contract)) throw Error('请填写有效的完整代币合约地址。')
      if (calc.error) throw Error(calc.error)
      let rows: Row[]
      if (mode === 'presale') {
        // Counts and 4:1 weights are fixed by the user's confirmed distribution terms.
        if (largeList.trim() || smallList.trim()) {
          validateList(large, 151); validateList(small, 360)
          rows = [...large.addresses.map(address => ({ address, amount: amountText(calc.large, decimals), group: '0.2 BNB · 4份' })), ...small.addresses.map(address => ({ address, amount: amountText(calc.small, decimals), group: '0.05 BNB · 1份' }))]
        } else {
          rows = [...Array.from({ length: 151 }, (_, i) => ({ address: `待提供 · 团队长 ${i + 1}`, amount: amountText(calc.large, decimals), group: '0.2 BNB · 4份' })), ...Array.from({ length: 360 }, (_, i) => ({ address: `待提供 · 普通私募 ${i + 1}`, amount: amountText(calc.small, decimals), group: '0.05 BNB · 1份' }))]
        }
      } else {
        if (mode === 'import') validateList(parsed)
        const recipients = mode === 'random' ? randomRecipients(countValue(count)) : parsed.addresses
        rows = recipients.map(address => ({ address, amount: amountText(units(perAddress, decimals), decimals), group: mode === 'random' ? '随机地址' : '导入地址' }))
      }
      setPlan({ rows, total: calc.total, remainder: amountText(calc.remainder, decimals), mode, token: contract, decimals, created: new Date().toLocaleString('zh-CN', { hour12: false }) }); setPage(0)
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    } catch (e) { setMessage((e as Error).message) }
  }
  async function upload(file: File | undefined, setter: (value: string) => void) {
    if (!file) return
    if (file.size > 2_000_000) { setMessage('文件请控制在 2 MB 以内。'); return }
    try { setter(await file.text()) } catch { setMessage('文件读取失败，请使用 UTF-8 编码的 CSV 或 TXT。') }
  }
  function exportPlan() {
    if (!plan) return
    download('蝴蝶股票_待发放清单.csv', csvText([['序号', '地址或待提供名额', '代币数量', '分组', '代币合约', '链ID', '精度', '状态'], ...plan.rows.map((r, i) => [i + 1, r.address, r.amount, r.group, plan.token, '56', plan.decimals, '待发送'])]))
  }
  const groupInput = (title: string, value: string, setter: (v: string) => void, result: ReturnType<typeof parseRecipients>, expected?: number) => <div className="ad-list-input"><div className="ad-label-row"><label>{title}</label><label className="ad-upload">导入 CSV<input type="file" accept=".csv,.txt" onChange={e => { void upload(e.target.files?.[0], setter); e.target.value = '' }}/></label></div><textarea aria-label={title} value={value} onChange={e => setter(e.target.value)} placeholder="每行一个 0x 地址，也可直接粘贴含地址列的 CSV" rows={4}/><div className="ad-hint">已识别 {result.addresses.length}{expected ? ` / ${expected}` : ''} 个地址{result.duplicates.length > 0 && ` · ${result.duplicates.length} 行重复`}{result.errors.length > 0 && ` · ${result.errors.length} 行无效`}</div></div>
  return <div className="ad-app">
    <aside className="ad-sidebar"><a className="ad-brand" href="/"><img src="/flap-stock-avatar.png" alt="蝴蝶股票"/><div>蝴蝶股票<small>FLAP STOCK</small></div></a><div className="ad-sidebar-label">社区工具箱</div><a className="ad-nav active" href="?view=airdrop"><Icon name="drop"/>批量空投<span>NEW</span></a><a className="ad-nav" href="?view=swap"><Icon name="settings"/>蝴蝶 Swap<small>↗</small></a><button className="ad-nav" onClick={() => { document.getElementById('ad-help')?.scrollIntoView({ behavior: 'smooth' }) }}><Icon name="info"/>使用说明</button><div className="ad-sidebar-bottom"><div className="ad-mini-art">✦</div><strong>让每一份共识<br/>准确抵达。</strong><p>BNB SMART CHAIN</p><a href="/">返回蝴蝶股票官网 ↗</a></div></aside>
    <div className="ad-workspace"><header className="ad-topbar"><div className="ad-breadcrumb">工具箱 <span>/</span> <strong>批量空投</strong></div><div className="ad-top-actions"><span className="ad-network"><i/>BSC <small>主网读取</small></span><button className="ad-wallet" onClick={() => setWalletMenu(!walletMenu)}><Icon name="wallet" size={17}/>{wallet ? `${short(wallet)} · 切换账户` : '连接钱包'}</button></div></header>
      {walletMenu && <div className="ad-wallet-panel" role="dialog" aria-label="选择钱包"><div className="ad-label-row"><strong>选择发送钱包</strong><button onClick={() => setWalletMenu(false)} aria-label="关闭钱包选择">×</button></div>{wallet && <p className="ad-current-sender">当前发送钱包<br/><strong>{wallet}</strong></p>}{activeProvider && <button className="ad-provider" disabled={connecting} onClick={() => void connect(activeProvider, true)}>{connecting ? '请在钱包中选择账户…' : '切换账户（打开钱包选择）'} <Icon name="arrow"/></button>}{providers.length ? providers.map(p => <button className="ad-provider" key={p.info.uuid} disabled={connecting} onClick={() => void connect(p, !!activeProvider)}>{p.info.name} <Icon name="arrow"/></button>) : <p>未检测到浏览器钱包。电脑请启用钱包扩展；手机请在 MetaMask 等钱包的内置浏览器中打开本页。</p>}<small>切换时请只选择本次发币账户，再确认连接。切换账户免费，不会发币；原账户任务记录会保留。</small>{message && <p role="alert" className="ad-error">{message}</p>}</div>}
      <main className="ad-main"><section className="ad-hero"><div><div className="ad-eyebrow"><span/> BUTTERFLY AIRDROP <b>真实链上发放</b></div><h1>把共识，<em>分发出去。</em></h1><p>从小额空投到私募分配，清楚核对每一个地址、每一枚代币。</p><div className="ad-hero-tags"><span><Icon name="check" size={14}/> 精确数量计算</span><span><Icon name="check" size={14}/> CSV 名单导入</span><span><Icon name="check" size={14}/> 私募 4∶1 配比</span></div></div><div className="ad-hero-art" aria-hidden="true"><div className="ad-orbit o1"/><div className="ad-orbit o2"/><div className="ad-art-logo"><img src="/flap-stock-avatar.png" alt=""/></div><span className="ad-satellite s1">↗</span><span className="ad-satellite s2">✦</span><span className="ad-satellite s3">+</span></div></section>
      <div className="ad-stepbar"><span className="on"><b>01</b> 配置发放</span><i/><span className={plan ? 'on' : ''}><b>02</b> 核对清单</span><i/><span><b>03</b> 钱包发放</span><small>由你在钱包中确认交易</small></div>
      <div className="ad-columns"><div className="ad-config"><section className="ad-card"><div className="ad-section-title"><span className="ad-icon-box"><Icon name="drop"/></span><div><h2>发放方式</h2><p>选择这次空投的接收方式</p></div></div><div className="ad-modes" role="tablist" aria-label="发放方式">{([['random', '随机地址', '链上小额空投'], ['import', '指定地址', '导入你的接收名单'], ['presale', '私募分配', '151 + 360 · 四比一']] as const).map(([key, title, sub]) => <button role="tab" aria-selected={mode === key} className={mode === key ? 'selected' : ''} key={key} onClick={() => setMode(key)}><span className="ad-radio"/><strong>{title}</strong><small>{sub}</small></button>)}</div></section>
      <section className="ad-card"><div className="ad-section-title"><span className="ad-icon-box"><Icon name="link"/></span><div><h2>代币合约</h2><p>仅支持 BNB Smart Chain 上的代币</p></div></div><label htmlFor="ad-contract">代币地址 <span className="ad-required">*</span></label><div className="ad-contract-field"><input id="ad-contract" spellCheck={false} value={contract} onChange={e => { setContract(e.target.value.trim()); setToken(null); setBalance(null); setReadError(''); readVersion.current++; setLoading(false) }} placeholder="0x…"/><button onClick={() => void readToken()} disabled={loading}>{loading ? '读取中…' : '读取信息'}</button></div><div className="ad-token-line">{token ? <><span className="ad-success-dot"/>{token.name} <span>· {token.symbol} / {token.decimals} 位精度</span></> : <span>{loading ? '正在读取真实链上信息…' : '预填合约来自参考截图，身份以链上读取及你的核对为准。'}</span>}</div>{readError && <p className="ad-inline-warning">{readError}</p>}<div className="ad-token-details"><div><span>钱包代币余额</span><strong>{!wallet ? '连接钱包后查看' : balance === null ? '暂未读取' : `${number(balance)} ${token?.symbol ?? ''}`}</strong></div><div><span>授权状态</span><strong>发送时检查授权</strong></div><div><span>代币资料</span>{token ? <a href={`https://bscscan.com/token/${token.address}`} target="_blank" rel="noreferrer">在 BscScan 查看 ↗</a> : <strong className="ad-muted">等待链上核对</strong>}</div></div></section>
      <section className="ad-card"><div className="ad-section-title"><span className="ad-icon-box"><Icon name="settings"/></span><div><h2>发放配置</h2><p>{mode === 'presale' ? '按已确认规则计算，0.2 BNB 档是 0.05 BNB 档的 4 倍' : '设置数量，右侧将实时更新发放摘要'}</p></div></div>{mode === 'presale' ? <><div className="ad-presale-stats"><div><small>团队长 · 0.2 BNB</small><strong>151 <span>个 × 4 份</span></strong></div><div><small>普通私募 · 0.05 BNB</small><strong>360 <span>个 × 1 份</span></strong></div><div><small>总分配权重</small><strong>964 <span>份</span></strong></div></div><label htmlFor="ad-total">本次用于私募发放的代币总量</label><input id="ad-total" inputMode="decimal" value={total} onChange={e => setTotal(e.target.value)} placeholder="输入总枚数，自动计算两档每人数量"/><div className="ad-allocation"><div><span>0.2 BNB 档 / 每人</span><strong>{calc.error ? '—' : number(amountText(calc.large, decimals))}</strong></div><div><span>0.05 BNB 档 / 每人</span><strong>{calc.error ? '—' : number(amountText(calc.small, decimals))}</strong></div></div><details className="ad-list-details"><summary>添加实际私募地址 <span>选填 · 可先算比例</span></summary>{groupInput('0.2 BNB 档名单', largeList, setLargeList, large, 151)}{groupInput('0.05 BNB 档名单', smallList, setSmallList, small, 360)}{overlap > 0 && <p className="ad-inline-warning">两档共有 {overlap} 个相同地址，会分别保留两档权益，不自动合并或删除。</p>}</details></> : <><div className="ad-fields"><div><label htmlFor="ad-amount">每个地址发放数量 <span className="ad-required">*</span></label><div className="ad-unit-input"><input id="ad-amount" inputMode="decimal" value={perAddress} onChange={e => setPerAddress(e.target.value)}/><span>枚</span></div><small>填写每个地址分配的代币数量。</small></div><div><label htmlFor="ad-count">{mode === 'random' ? '总发放地址数量' : '已识别有效地址'} <span className="ad-required">*</span></label><div className="ad-unit-input"><input id="ad-count" inputMode="numeric" value={mode === 'random' ? count : parsed.addresses.length} readOnly={mode === 'import'} onChange={e => setCount(e.target.value)}/><span>个</span></div><small>{mode === 'random' ? '每次生成 1–200 个随机地址。' : '按导入名单自动统计，上限 2000 个。'}</small></div></div>{mode === 'random' ? <div className="ad-notice"><Icon name="info" size={18}/><span>随机地址不代表真实用户，发出的代币可能无人控制且无法收回。私募请导入实际接收名单。</span></div> : groupInput('接收地址名单', list, setList, parsed)}</>}</section>
      <section className="ad-help" id="ad-help"><h3>提交前，先核对这三件事</h3><div><span>01</span><p><strong>确认代币</strong>核对完整合约地址，避免同名币混淆。</p></div><div><span>02</span><p><strong>确认分配</strong>按最小单位向下取整，保留余量，确保 4∶1 精确。</p></div><div><span>03</span><p><strong>确认接收人</strong>核对接收名单后，按页面步骤在钱包中确认授权和发送。</p></div></section></div>
      <aside className="ad-summary-column"><section className="ad-summary"><div className="ad-summary-title"><h2>发放摘要</h2><span>实时计算</span></div><div className="ad-summary-total"><span>预计发放总量</span><strong>{calc.total === '—' ? '—' : number(calc.total)}</strong><small>{token?.symbol || '代币 · 待核对'}</small></div><dl><div><dt>网络</dt><dd><i className="ad-success-dot"/>BNB Smart Chain</dd></div><div><dt>接收方式</dt><dd>{mode === 'random' ? '随机地址' : mode === 'import' ? '指定地址' : '私募 4∶1 分配'}</dd></div><div><dt>发放名额</dt><dd>{calc.count || '—'} 个</dd></div><div><dt>每地址数量</dt><dd>{mode === 'presale' ? '按 1 / 4 份分配' : perAddress || '—'}</dd></div><div><dt>工具费用</dt><dd>0 BNB</dd></div><div><dt>网络 Gas</dt><dd>签名前估算</dd></div>{mode === 'presale' && !calc.error && <div><dt>未分配余量</dt><dd className="ad-remainder">{amountText(calc.remainder, decimals)} 枚</dd></div>}</dl><div className="ad-summary-check"><Icon name="check" size={15}/> {token ? '已读取代币资料' : '代币资料待核对，不能发币'}</div><button className="ad-primary" onClick={generate}>生成发放清单 <Icon name="arrow" size={19}/></button><p className="ad-under-button">先核对清单，再连接钱包完成真实发放。</p>{message && <p role="alert" className="ad-error">{message}</p>}</section><section className="ad-side-tip"><span>✦</span><div><strong>每一份，都有依据。</strong><p>名单保存在本机；模拟与发送时会提交链上请求。</p></div></section><div className="ad-preview-note"><Icon name="info" size={15}/> BSC 主网 · 钱包签名后真实执行</div></aside></div>
      {plan && <section className="ad-card ad-results" ref={resultRef} aria-label="发放清单"><div className="ad-results-heading"><div><span className="ad-eyebrow">DISTRIBUTION PLAN</span><h2>发放清单已生成 <small>尚未发送</small></h2><p>{plan.created} · 共 {plan.rows.length} 条 · 合计 {number(plan.total)} 枚</p></div><a className="ad-export" href="#ad-live">准备真实发送 ↓</a><button className="ad-export" onClick={exportPlan}><Icon name="file" size={17}/>导出 CSV</button></div>{plan.mode === 'presale' && plan.rows.some(r => !r.address.startsWith('0x')) && <div className="ad-notice">这是比例计算表。接收地址尚未提供，不能用于实际转账。</div>}{plan.mode === 'random' && <div className="ad-notice">以下为随机地址。核对并确认后才会真实发送；不能把它们当作真实社区用户。</div>}<div className="ad-table-scroll"><table><thead><tr><th>序号</th><th>接收地址 / 名额</th><th>代币数量</th><th>分组</th><th>状态</th></tr></thead><tbody>{plan.rows.slice(page * 10, (page + 1) * 10).map((r, i) => <tr key={page * 10 + i}><td>{page * 10 + i + 1}</td><td className="ad-address">{r.address}</td><td>{number(r.amount)}</td><td>{r.group}</td><td><span className="ad-status">待发送</span></td></tr>)}</tbody></table></div><div className="ad-pagination"><span>共 {plan.rows.length} 条 · 第 {page + 1} / {Math.ceil(plan.rows.length / 10)} 页</span><div><button disabled={!page} onClick={() => setPage(page - 1)}>上一页</button><button disabled={(page + 1) * 10 >= plan.rows.length} onClick={() => setPage(page + 1)}>下一页</button></div></div></section>}
      <LiveSendPanel key={wallet.toLowerCase()} asset={token??undefined} onNewTask={()=>{setPlan(null);setPage(0)}} wallet={wallet} provider={activeProvider?.provider} plan={plan} verified={!!token && token.address.toLowerCase() === plan?.token.toLowerCase() && token.decimals === plan?.decimals}/><footer className="ad-footer"><span>蝴蝶股票 <b>·</b> FLAP STOCK</span><span>振翅，让故事发生。 <a href="/">返回官网 ↗</a></span></footer></main>
    </div>
  </div>
}
