import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createWalletClient, custom, formatUnits, isAddress, type Address, type Hash } from 'viem'
import { bsc } from 'viem/chains'
import { discoverWalletProviders, type WalletProviderDetail } from '../web3/walletProviders'
import { ROUTER, TOKENS, homeHref, tokenKey, type SwapToken } from './config'
import { approveExact, displayAmount, executeSwap, friendlySwapError, getAllowance, getQuote, importToken, makeSwapClient, minimumReceived, parseAmount, readBalance, type SwapQuote, type SwapReview } from './service'
import './swap.css'

type Transaction = { hash: Hash; account: Address; title: string; time: number; status: 'pending' | 'success' | 'reverted' }
const TX_KEY = 'butterfly-swap-transactions-v1'
const short = (value: string) => value.slice(0, 6) + '…' + value.slice(-4)
const readTransactions = (): Transaction[] => {
  try { const values = JSON.parse(localStorage.getItem(TX_KEY) ?? '[]'); return Array.isArray(values) ? values.filter(t => /^0x[a-fA-F0-9]{64}$/.test(t.hash) && isAddress(t.account) && typeof t.title === 'string' && ['pending', 'success', 'reverted'].includes(t.status)).slice(0, 12) : [] } catch { return [] }
}
function TokenIcon({ token }: { token: SwapToken }) {
  return <span className="swap-token-icon" style={{ background: token.color }} aria-hidden="true">{({ BNB: '◆', WBNB: '◆', USDT: '₮', USDC: '$', BTCB: '₿', ETH: 'Ξ', CAKE: '◒' } as Record<string, string>)[token.symbol] ?? token.symbol.slice(0, 1)}</span>
}
function Dialog({ title, onClose, children, busy = false }: { title: string; onClose: () => void; children: ReactNode; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { ref.current?.showModal(); const old = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = old; ref.current?.close() } }, [])
  return <dialog ref={ref} className="swap-dialog" aria-label={title} onCancel={e => { e.preventDefault(); if (!busy) onClose() }} onClick={e => { if (e.target === e.currentTarget && !busy) onClose() }}><div className="swap-dialog-head"><h2>{title}</h2><button className="swap-icon-button" disabled={busy} aria-label="关闭窗口" onClick={onClose}>×</button></div>{children}</dialog>
}

export function SwapPage() {
  const client = useMemo(makeSwapClient, [])
  const [input, setInput] = useState<SwapToken>(TOKENS[0])
  const [output, setOutput] = useState<SwapToken>(TOKENS[1])
  const [amount, setAmount] = useState('')
  const [slippage, setSlippage] = useState(50)
  const [customSlippage, setCustomSlippage] = useState('')
  const [settings, setSettings] = useState(false)
  const [quote, setQuote] = useState<SwapQuote | null>(null)
  const [quoteError, setQuoteError] = useState('')
  const [quoteBusy, setQuoteBusy] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [clock, setClock] = useState(Date.now())
  const [providers, setProviders] = useState<WalletProviderDetail[]>([])
  const [selectedWallet, setSelectedWallet] = useState<WalletProviderDetail | null>(null)
  const [account, setAccount] = useState<Address | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [walletOpen, setWalletOpen] = useState(false)
  const [balance, setBalance] = useState<bigint | null>(null)
  const [outBalance, setOutBalance] = useState<bigint | null>(null)
  const [balanceRefresh, setBalanceRefresh] = useState(0)
  const [tokenSide, setTokenSide] = useState<'input' | 'output' | null>(null)
  const [search, setSearch] = useState('')
  const [imported, setImported] = useState<SwapToken | null>(null)
  const [importError, setImportError] = useState('')
  const [importBusy, setImportBusy] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [customTokens, setCustomTokens] = useState<SwapToken[]>([])
  const [review, setReview] = useState<SwapReview | null>(null)
  const [allowance, setAllowance] = useState<bigint | null>(null)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const session = useRef(0)
  const [message, setMessage] = useState('')
  const [transactions, setTransactions] = useState<Transaction[]>(readTransactions)
  const [activeTab, setActiveTab] = useState<'swap' | 'history'>('swap')
  const home = homeHref()
  const stale = !quote || clock >= quote.expiresAt
  const pending = transactions.find(t => t.status === 'pending' && t.account.toLowerCase() === account?.toLowerCase())
  const canReview = Boolean(account && quote && !stale && !quoteBusy && quote.impactBps < 1000 && !pending && balance !== null && balance >= quote.amountIn)

  useEffect(() => { document.body.classList.add('swap-route'); document.title = '蝴蝶swap · BNB Chain 代币兑换'; return () => document.body.classList.remove('swap-route') }, [])
  useEffect(() => discoverWalletProviders(setProviders), [])
  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer) }, [])
  useEffect(() => { const timer = window.setInterval(() => { if (!review && !document.hidden) setRefresh(x => x + 1) }, 20_000); return () => clearInterval(timer) }, [review])
  useEffect(() => { try { localStorage.setItem(TX_KEY, JSON.stringify(transactions.slice(0, 12))) } catch { /* current-session history still works */ } }, [transactions])

  useEffect(() => {
    let cancelled = false
    setQuote(null); setQuoteError(''); setQuoteBusy(false)
    if (!amount.trim()) return
    let parsed: bigint
    try { parsed = parseAmount(amount, input.decimals) } catch (error) { setQuoteError(friendlySwapError(error)); return }
    setQuoteBusy(true)
    const timer = window.setTimeout(() => {
      void getQuote(client, input, output, parsed).then(value => { if (!cancelled) { setQuote(value); setClock(Date.now()) } }).catch(error => { if (!cancelled) setQuoteError(friendlySwapError(error)) }).finally(() => { if (!cancelled) setQuoteBusy(false) })
    }, 400)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [client, input, output, amount, refresh])
  useEffect(() => {
    let cancelled = false
    setBalance(null); setOutBalance(null)
    if (account) void Promise.all([readBalance(client, input, account), readBalance(client, output, account)]).then(([a, b]) => { if (!cancelled) { setBalance(a); setOutBalance(b) } }).catch(() => { if (!cancelled) setMessage('暂时无法读取余额，请点击余额刷新。') })
    return () => { cancelled = true }
  }, [client, account, input, output, balanceRefresh])
  useEffect(() => {
    const provider = selectedWallet?.provider as (WalletProviderDetail['provider'] & { on?: (event: string, fn: (...args: unknown[]) => void) => void; removeListener?: (event: string, fn: (...args: unknown[]) => void) => void }) | undefined
    if (!provider) return
    const invalidate = () => { session.current++; setReview(null); setAccount(null); setSelectedWallet(null); setChainId(null); setMessage('钱包账户或网络已改变，请重新连接。') }
    provider.on?.('accountsChanged', invalidate); provider.on?.('chainChanged', invalidate); provider.on?.('disconnect', invalidate)
    return () => { provider.removeListener?.('accountsChanged', invalidate); provider.removeListener?.('chainChanged', invalidate); provider.removeListener?.('disconnect', invalidate) }
  }, [selectedWallet])
  useEffect(() => {
    let cancelled = false; setAllowance(null)
    if (review) void getAllowance(client, review.quote, review.account).then(value => { if (!cancelled) setAllowance(value) }).catch(() => { if (!cancelled) setMessage('授权状态读取失败，请关闭窗口后重试。') })
    return () => { cancelled = true }
  }, [client, review])
  useEffect(() => {
    let cancelled = false; setImported(null); setImportError(''); setAccepted(false); setImportBusy(false)
    if (!search.trim().startsWith('0x')) return
    if (!isAddress(search.trim())) { setImportError('请输入完整的 0x 合约地址。'); return }
    setImportBusy(true)
    void importToken(client, search.trim()).then(t => { if (!cancelled) setImported(t) }).catch(error => { if (!cancelled) setImportError(friendlySwapError(error)) }).finally(() => { if (!cancelled) setImportBusy(false) })
    return () => { cancelled = true }
  }, [client, search])
  const checkTransactions = useCallback(async () => {
    const waiting = transactions.filter(t => t.status === 'pending')
    if (!waiting.length) return
    const results = await Promise.all(waiting.map(async t => {
      try { const receipt = await client.getTransactionReceipt({ hash: t.hash }); return { hash: t.hash, status: receipt.status } } catch { return null }
    }))
    setTransactions(current => current.map(t => { const r = results.find(r => r?.hash === t.hash); return r ? { ...t, status: r.status } : t }))
    setBalanceRefresh(x => x + 1)
    setMessage(results.some(Boolean) ? '交易状态已更新。' : '交易仍待确认，请查看 BscScan；不要重复提交。')
  }, [client, transactions])

  const connect = async (detail: WalletProviderDetail) => {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); setMessage('')
    try {
      const wallet = createWalletClient({ transport: custom(detail.provider), chain: bsc })
      const [address] = await wallet.requestAddresses()
      if (!address) return
      if (await wallet.getChainId() !== 56) {
        try { await wallet.switchChain({ id: 56 }) } catch (error) {
          if (Number((error as { code?: number }).code) !== 4902 && !String((error as Error).message).includes('4902')) throw error
          await wallet.addChain({ chain: bsc }); await wallet.switchChain({ id: 56 })
        }
      }
      const currentChain = await wallet.getChainId()
      const [currentAddress] = await wallet.getAddresses()
      session.current++; setAccount(currentAddress ?? null); setSelectedWallet(detail); setChainId(currentChain); setWalletOpen(false)
    } catch (error) { setMessage(friendlySwapError(error)) } finally { inFlight.current = false; setBusy(false) }
  }
  const pickToken = (token: SwapToken) => {
    if (tokenSide === 'input') { if (tokenKey(token) === tokenKey(output)) setOutput(input); setInput(token) }
    else { if (tokenKey(token) === tokenKey(input)) setInput(output); setOutput(token) }
    if (token.custom && !customTokens.some(t => tokenKey(t) === tokenKey(token))) setCustomTokens(list => [...list, token])
    setTokenSide(null); setSearch(''); setMessage('')
  }
  const openReview = () => {
    if (!canReview || !quote || !account) return
    setMessage(''); setReview({ quote, account, slippageBps: slippage, minimumOut: quote.wrap ? quote.amountOut : minimumReceived(quote.amountOut, slippage) })
  }
  const transact = async (approval: boolean) => {
    if (!selectedWallet || !review || inFlight.current || pending) return
    const actionSession = session.current
    inFlight.current = true; setBusy(true); setMessage('正在核对交易，请在钱包中确认。')
    let hash: Hash | null = null
    try {
      const wallet = createWalletClient({ chain: bsc, transport: custom(selectedWallet.provider) })
      hash = approval ? await approveExact(client, wallet, review) : await executeSwap(client, wallet, review)
      const title = approval ? (allowance && allowance > 0n ? '重置 ' : '授权 ') + review.quote.input.symbol : `${displayAmount(review.quote.amountIn, review.quote.input.decimals)} ${review.quote.input.symbol} → ${review.quote.output.symbol}`
      setTransactions(list => [{ hash: hash!, account: review.account, title, time: Date.now(), status: 'pending' as const }, ...list].slice(0, 12))
      setMessage('交易已提交，正在等待链上确认…')
      let replacement = false
      const receipt = await client.waitForTransactionReceipt({ hash, timeout: 90_000, onReplaced: () => { replacement = true } })
      if (replacement) { setMessage('钱包中的交易已被替换，请在 BscScan 核对结果。原记录保留待确认状态。'); setReview(null); return }
      setTransactions(list => list.map(t => t.hash === hash ? { ...t, status: receipt.status } : t))
      if (receipt.status !== 'success') { setMessage('交易未执行成功，请查看链上记录。'); return }
      if (actionSession === session.current) { setReview(null); setRefresh(n => n + 1); setBalanceRefresh(n => n + 1); if (!approval) setAmount('') }
      setMessage(approval ? '授权操作已确认。请获取新报价，再确认兑换。' : '兑换已确认，资产已发送到你的钱包。')
    } catch (error) { setMessage(hash ? '交易已发送，暂时无法确认结果。请查看交易记录并检查状态，勿重复提交。' : friendlySwapError(error)); if (hash) setReview(null) }
    finally { inFlight.current = false; setBusy(false) }
  }
  const filteredTokens = [...TOKENS, ...customTokens].filter(t => `${t.symbol} ${t.name} ${t.address}`.toLowerCase().includes(search.trim().toLowerCase()))
  const availablePercent = (percent: number) => {
    if (balance === null) return
    const available = input.native ? balance > 500_000_000_000_000n ? balance - 500_000_000_000_000n : 0n : balance
    setAmount(formatUnits(available * BigInt(percent) / 100n, input.decimals))
  }
  const approvalRequired = review && allowance !== null && allowance < review.quote.amountIn

  return <div className="swap-page">
    <a className="swap-skip" href="#swap-form">跳到兑换</a>
    <header className="swap-header">
      <a className="swap-brand" href={home}><img src="/flap-stock-avatar.png" alt="" /><span>蝴蝶股票<small>FLAP STOCK</small></span></a>
      <nav aria-label="主导航"><a href={home}>首页</a><a href={`${home}?view=markets`}>美股动态</a><a href="?view=swap" aria-current="page">蝴蝶swap <span>↗</span></a></nav>
      <div className="swap-header-actions"><span className="swap-chain"><i /> BNB Chain</span><button className="swap-primary" onClick={() => setWalletOpen(true)}>{account ? short(account) : '连接钱包'}</button></div>
    </header>
    <main className="swap-main">
      <div className="swap-topline"><span><i /> PANCAKESWAP V2 · BNB CHAIN</span><span className="swap-preview-label">预览版</span></div>
      <div className="swap-layout">
        <section className="swap-intro">
          <p className="swap-eyebrow">BUTTERFLY SWAP / 01</p><h1>让资产，<br /><span>自由换个方向。</span></h1>
          <p className="swap-intro-copy">在熟悉的蝴蝶世界，<br />轻松兑换 BNB Chain 资产。</p>
          <div className="swap-art" aria-hidden="true"><span className="swap-orbit orbit-one" /><span className="swap-orbit orbit-two" /><img src="/flap-stock-avatar.png" alt="" /><span className="swap-art-star">✳</span><span className="swap-art-arrow">↗</span></div>
          <div className="swap-principles"><span><b>01</b> 选择资产</span><span><b>02</b> 核对报价</span><span><b>03</b> 钱包确认</span></div>
          <p className="swap-intro-foot">由 PancakeSwap V2 提供流动性<br /><strong>蝴蝶swap 平台服务费 0%</strong> · 池费与网络费另计</p>
        </section>
        <section className="swap-workspace" id="swap-form" aria-label="代币兑换">
          <div className="swap-card">
            <div className="swap-card-toolbar"><div role="tablist" aria-label="兑换和记录"><button role="tab" aria-selected={activeTab === 'swap'} onClick={() => setActiveTab('swap')}>兑换</button><button role="tab" aria-selected={activeTab === 'history'} onClick={() => setActiveTab('history')}>交易记录{transactions.length > 0 && <small>{transactions.length}</small>}</button></div><button className="swap-icon-button" aria-label="兑换设置" onClick={() => setSettings(true)}>⚙</button></div>
            {activeTab === 'swap' ? <>
              <div className="swap-card-title"><h2>简单兑换<span>SWAP</span></h2><p>输入数量，查看链上报价</p></div>
              <div className="swap-asset-box"><div className="swap-asset-label"><label htmlFor="swap-amount">你支付</label><button onClick={() => setBalanceRefresh(x => x + 1)} disabled={!account}>余额：{balance === null ? '—' : displayAmount(balance, input.decimals)} ↻</button></div><div className="swap-asset-main"><input id="swap-amount" inputMode="decimal" autoComplete="off" placeholder="0.0" value={amount} maxLength={100} onChange={e => setAmount(e.target.value.trim())} /><button className="swap-token-selector" onClick={() => { setTokenSide('input'); setSearch('') }} aria-label={`选择支付代币，当前 ${input.symbol}`}><TokenIcon token={input} /><strong>{input.symbol}</strong><span>⌄</span></button></div><div className="swap-percentages">{[25, 50, 75, 100].map(n => <button key={n} disabled={balance === null} onClick={() => availablePercent(n)}>{n === 100 ? 'MAX' : n + '%'}</button>)}</div></div>
              <div className="swap-direction"><button aria-label="交换支付与接收代币" onClick={() => { setInput(output); setOutput(input); setAmount(''); setMessage('') }}>↓</button></div>
              <div className="swap-asset-box swap-output"><div className="swap-asset-label"><span>你接收 <small>· 预计</small></span><span>余额：{outBalance === null ? '—' : displayAmount(outBalance, output.decimals)}</span></div><div className="swap-asset-main"><output aria-label="预计收到数量" className={!quote ? 'swap-placeholder' : ''}>{quoteBusy ? '…' : quote ? displayAmount(quote.amountOut, output.decimals) : '0.0'}</output><button className="swap-token-selector" onClick={() => { setTokenSide('output'); setSearch('') }} aria-label={`选择接收代币，当前 ${output.symbol}`}><TokenIcon token={output} /><strong>{output.symbol}</strong><span>⌄</span></button></div><div className="swap-asset-detail">{output.custom ? '自定义代币 · 请核对合约' : output.name}</div></div>
              <div className="swap-slippage-row"><span>滑点上限</span><button onClick={() => setSettings(true)}>{(slippage / 100).toFixed(1)}% <span>调整</span></button></div>
              {quote && <div className="swap-quote-details"><div><span>最低收到</span><b>{displayAmount(quote.wrap ? quote.amountOut : minimumReceived(quote.amountOut, slippage), output.decimals)} {output.symbol}</b></div><div><span>价格影响</span><b className={quote.impactBps >= 300 ? 'swap-danger' : ''}>{(quote.impactBps / 100).toFixed(2)}%</b></div><div><span>报价更新</span><button onClick={() => setRefresh(x => x + 1)}>{stale ? '已过期 · 刷新 ↻' : `${Math.ceil((quote.expiresAt - clock) / 1000)} 秒内有效 ↻`}</button></div></div>}
              {quoteError && <p className="swap-alert" role="alert">{quoteError} <button onClick={() => setRefresh(x => x + 1)}>重试</button></p>}
              {quote && quote.impactBps >= 1000 && <p className="swap-alert">价格影响超过 10%，请减少兑换数量。</p>}
              {input.native && account && <p className="swap-small-note">MAX 会预留 0.0005 BNB；实际网络费以钱包为准。</p>}
              {(input.custom || output.custom) && <p className="swap-small-note">代币可能收取转账税。预计输出未扣代币税费，最低到账仍受滑点限制。</p>}
              <button className="swap-primary swap-submit" disabled={busy || (!!account && !canReview)} onClick={() => account ? openReview() : setWalletOpen(true)}>{!account ? '连接钱包' : pending ? '上一笔交易待确认' : quoteBusy ? '正在获取报价…' : !amount ? '输入兑换数量' : quote && balance !== null && balance < quote.amountIn ? '余额不足' : quote && stale ? '请刷新报价' : quote ? '预览兑换 →' : '等待有效报价'}</button>
              <p className="swap-card-foot">{account ? `${short(account)} · ${chainId === 56 ? 'BNB Smart Chain' : '请切换 BNB Chain'}` : '先查看报价，连接钱包后确认兑换'}</p>
            </> : <div className="swap-history"><div className="swap-history-head"><h2>交易记录</h2><button onClick={() => void checkTransactions()}>刷新状态 ↻</button></div><p>仅保存在当前浏览器，链上结果以 BscScan 为准。</p>{transactions.length ? transactions.map(t => <a href={`https://bscscan.com/tx/${t.hash}`} key={t.hash} target="_blank" rel="noopener noreferrer"><span className={`swap-tx-status ${t.status}`}>{t.status === 'success' ? '✓' : t.status === 'pending' ? '◷' : '×'}</span><div><strong>{t.title}</strong><small>{short(t.account)} · {new Date(t.time).toLocaleString('zh-CN')}</small><small>{short(t.hash)}</small></div><span>{t.status === 'success' ? '已确认' : t.status === 'pending' ? '待确认' : '未成功'} ↗</span></a>) : <div className="swap-empty"><span>↔</span><h3>你的下一次兑换，从这里开始</h3><p>提交交易后，记录会显示在这里。</p><button onClick={() => setActiveTab('swap')}>开始兑换 →</button></div>}</div>}
            {message && <p className="swap-feedback" role="status">{message}</p>}
            {pending && <p className="swap-pending"><a href={`https://bscscan.com/tx/${pending.hash}`} target="_blank" rel="noopener noreferrer">查看待确认交易 ↗</a><button onClick={() => void checkTransactions()}>检查状态</button></p>}
          </div>
          <div className="swap-route-card"><div><span className="swap-route-symbol">↳</span><strong>{quote?.wrap ? 'BNB / WBNB 包装转换' : 'PancakeSwap V2 路由'}</strong><span className="swap-live-dot" /></div><p>{quote ? quote.path.map(a => a.toLowerCase() === input.address.toLowerCase() ? input.symbol : a.toLowerCase() === output.address.toLowerCase() ? output.symbol : TOKENS.find(t => !t.native && t.address.toLowerCase() === a.toLowerCase())?.symbol ?? short(a)).join(' → ') : '输入数量后，对比直连及常用中间币路径。'}</p><small>{quote ? `报价区块 #${quote.block.toString()} · ${quote.wrap ? '1:1 转换' : '已对比路径中的最高输出，非全市场最优报价'}` : '真实链上报价 · 当前支持 V2，不含 V3 / Infinity'}</small></div>
        </section>
      </div>
      <section className="swap-bottom-strip"><div><span>01 / YOUR WALLET</span><h3>资产，在你手中。</h3><p>每次授权与兑换均由你的钱包确认。</p></div><div><span>02 / CLEAR QUOTES</span><h3>看清楚，再兑换。</h3><p>报价、滑点、最低收到数量逐项展示。</p></div><div><span>03 / ON-CHAIN</span><h3>每一笔，都有记录。</h3><p>通过 BscScan 查看交易执行结果。</p></div></section>
    </main>
    <footer className="swap-footer"><a href={home}>蝴蝶股票 <b>FLAP STOCK</b></a><p>流动性来源 PancakeSwap V2 · 平台服务费 0% · 池费、代币税与网络费另计</p><a href={`https://bscscan.com/address/${ROUTER}`} target="_blank" rel="noopener noreferrer">查看路由合约 ↗</a></footer>

    {walletOpen && <Dialog title={account ? '你的钱包' : '连接钱包'} onClose={() => setWalletOpen(false)} busy={busy}>{account && <div className="swap-wallet-current"><p>{account}</p><button onClick={() => { session.current++; setAccount(null); setSelectedWallet(null); setReview(null); setWalletOpen(false) }}>断开连接</button></div>}<p className="swap-dialog-description">使用 BNB Chain 钱包连接蝴蝶swap。</p><div className="swap-wallet-list">{providers.map(p => <button disabled={busy} key={p.info.uuid} onClick={() => void connect(p)}>{p.info.icon && <img src={p.info.icon} alt="" />}<span>{p.info.name}<small>{p.info.rdns}</small></span><b>↗</b></button>)}</div>{!providers.length && <div className="swap-wallet-help"><strong>在钱包的 DApp 浏览器中打开</strong><p>手机用户可复制当前链接，粘贴到 MetaMask、OKX 或 TokenPocket 的浏览器；电脑用户请启用浏览器钱包扩展。</p><button onClick={async () => { try { await navigator.clipboard.writeText(window.location.href); setMessage('页面链接已复制。') } catch { setMessage('请从浏览器地址栏复制当前网址。') } }}>复制当前页面链接</button></div>}{message && <p className="swap-feedback" role="status">{message}</p>}</Dialog>}
    {tokenSide && <Dialog title="选择代币" onClose={() => setTokenSide(null)}><input className="swap-token-search" autoFocus aria-label="搜索代币名称或合约地址" placeholder="搜索名称或粘贴 0x 合约地址" value={search} onChange={e => setSearch(e.target.value)} maxLength={120} /><p className="swap-dialog-description">BNB Chain · 请以合约地址识别资产</p><div className="swap-token-list">{filteredTokens.map(t => <button key={tokenKey(t)} onClick={() => pickToken(t)}><TokenIcon token={t} /><span><strong>{t.symbol}</strong><small>{t.name}</small></span><small>{t.native ? '原生 BNB' : short(t.address)}</small></button>)}</div>{importBusy && <p role="status">正在读取合约信息…</p>}{importError && <p className="swap-alert" role="alert">{importError}</p>}{imported && !filteredTokens.some(t => tokenKey(t) === tokenKey(imported)) && <div className="swap-import"><h3>{imported.symbol}</h3><p>{imported.name}</p><code>{imported.address}</code><p>任何人都可以创建同名代币。此资产不在常用列表中；元数据读取成功不代表资产安全或能够卖出。</p><label><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} />我已核对合约地址，了解自定义代币风险</label><button className="swap-primary" disabled={!accepted} onClick={() => pickToken(imported)}>导入并选择</button></div>}{!filteredTokens.length && !imported && !importBusy && !importError && <p className="swap-dialog-description">未找到代币。可粘贴完整合约地址。</p>}</Dialog>}
    {settings && <Dialog title="兑换设置" onClose={() => setSettings(false)}><h3>滑点上限</h3><p className="swap-dialog-description">允许报价与实际成交之间的最大差异。</p><div className="swap-settings-options">{[10, 50, 100].map(n => <button key={n} aria-pressed={slippage === n} onClick={() => { setSlippage(n); setCustomSlippage('') }}>{n / 100}%</button>)}<label><input aria-label="自定义滑点百分比" placeholder="自定义" inputMode="decimal" value={customSlippage} onChange={e => { setCustomSlippage(e.target.value); const n = Number(e.target.value); if (/^\d*\.?\d{0,1}$/.test(e.target.value) && n >= .1 && n <= 5) setSlippage(Math.round(n * 100)) }} />%</label></div><p className="swap-dialog-description">当前生效：{slippage / 100}% · 支持 0.1%–5%</p>{slippage > 100 && <p className="swap-alert">较高滑点可能导致较差成交价格，请谨慎使用。</p>}<div className="swap-settings-note"><b>授权额度：仅本次数量</b><p>授权对象为 PancakeSwap V2 路由。BNB 兑换不需要代币授权。</p><b>交易有效期：2 分钟</b><p>报价 30 秒过期；确认窗口中的数量不会自动变化。</p></div><button className="swap-primary swap-submit" onClick={() => setSettings(false)}>完成设置</button></Dialog>}
    {review && <Dialog title="确认兑换" onClose={() => setReview(null)} busy={busy}><div className="swap-review-assets"><div><TokenIcon token={review.quote.input} /><strong>{displayAmount(review.quote.amountIn, review.quote.input.decimals)} {review.quote.input.symbol}</strong></div><span>↓</span><div><TokenIcon token={review.quote.output} /><strong>≈ {displayAmount(review.quote.amountOut, review.quote.output.decimals)} {review.quote.output.symbol}</strong></div></div><dl className="swap-review-details"><div><dt>最低收到</dt><dd>{displayAmount(review.minimumOut, review.quote.output.decimals)} {review.quote.output.symbol}</dd></div><div><dt>滑点上限</dt><dd>{review.slippageBps / 100}%</dd></div><div><dt>收款钱包</dt><dd>{short(review.account)}</dd></div><div><dt>网络</dt><dd>BNB Smart Chain (56)</dd></div><div><dt>支付资产</dt><dd>{review.quote.input.native ? 'BNB' : short(review.quote.input.address)}</dd></div><div><dt>接收资产</dt><dd>{review.quote.output.native ? 'BNB' : short(review.quote.output.address)}</dd></div></dl>{(review.quote.input.custom || review.quote.output.custom) && <p className="swap-alert">此兑换包含自定义代币，预计数量未扣代币税费。</p>}{clock >= review.quote.expiresAt && <p className="swap-alert">报价已过期。请关闭窗口，刷新后重新确认。</p>}{message && <p className="swap-feedback" role="status">{message}</p>}<button className="swap-primary swap-submit" disabled={busy || allowance === null || clock >= review.quote.expiresAt || Boolean(pending)} onClick={() => void transact(Boolean(approvalRequired))}>{busy ? '请等待钱包 / 链上确认…' : allowance === null ? '核对授权中…' : approvalRequired ? (allowance > 0n ? '先重置旧授权' : `授权 ${displayAmount(review.quote.amountIn, review.quote.input.decimals)} ${review.quote.input.symbol}`) : '在钱包中确认兑换'}</button><p className="swap-small-note">{approvalRequired ? '授权完成后会重新报价，再由你确认兑换。' : '提交前会模拟交易；网络费由钱包显示。'}</p></Dialog>}
  </div>
}
