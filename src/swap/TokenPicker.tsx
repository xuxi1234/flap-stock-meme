import { useEffect, useRef, useState, type ReactNode } from 'react'
import { isAddress, type PublicClient } from 'viem'
import { TOKENS, matchesToken, tokenKey, type SwapToken } from './config'
import { importToken, friendlySwapError } from './service'
import { TokenIcon } from './TokenIcon'

export function ProductDialog({ title, onClose, children, busy = false }: { title: string; onClose: () => void; children: ReactNode; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const el = ref.current; el?.showModal(); return () => el?.close() }, [])
  return <dialog ref={ref} className="swap-dialog" aria-label={title} onCancel={e => { e.preventDefault(); if (!busy) onClose() }} onClick={e => { if (e.target === e.currentTarget && !busy) onClose() }}><div className="swap-dialog-head"><h2>{title}</h2><button disabled={busy} className="swap-icon-button" aria-label="关闭窗口" onClick={onClose}>×</button></div>{children}</dialog>
}

export function TokenPicker({ client, onSelect, onClose, favorites = [] }: { client: PublicClient; onSelect: (t: SwapToken) => void; onClose: () => void; favorites?: string[] }) {
  const [query, setQuery] = useState('')
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [imported, setImported] = useState<SwapToken | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [accepted, setAccepted] = useState(false)
  useEffect(() => {
    let cancelled = false
    setImported(null); setError(''); setBusy(false); setAccepted(false)
    const address = query.trim()
    if (!address.startsWith('0x') || TOKENS.some(t => t.address.toLowerCase() === address.toLowerCase())) return
    if (!isAddress(address)) { setError('请输入完整的 BNB Chain 合约地址。'); return }
    setBusy(true)
    void importToken(client, address).then(t => { if (!cancelled) setImported(t) }).catch(e => { if (!cancelled) setError(friendlySwapError(e)) }).finally(() => { if (!cancelled) setBusy(false) })
    return () => { cancelled = true }
  }, [query, client])
  const visible = TOKENS.filter(t => matchesToken(t, query) && (!onlyFavorites || favorites.includes(t.address.toLowerCase())))
  return <ProductDialog title="搜索与选择代币" onClose={onClose}><input className="swap-token-search" autoFocus aria-label="全站代币搜索" placeholder="名称、代码或完整合约地址" value={query} maxLength={120} onChange={e => setQuery(e.target.value)} /><div className="swap-token-filters"><button aria-pressed={!onlyFavorites} onClick={() => setOnlyFavorites(false)}>全部资产</button><button aria-pressed={onlyFavorites} onClick={() => setOnlyFavorites(true)}>我的收藏</button></div><p className="swap-dialog-description">BNB Chain · 合约地址是资产的唯一标识</p><div className="swap-token-list">{visible.map(t => <button key={tokenKey(t)} onClick={() => onSelect(t)}><TokenIcon token={t} /><span><strong>{t.symbol}</strong><small>{t.name}</small></span><small>{t.native ? '原生 BNB' : `${t.address.slice(0,6)}…${t.address.slice(-4)}`}</small></button>)}</div>{busy && <p role="status">正在读取链上代币信息…</p>}{error && <p className="swap-alert" role="alert">{error}</p>}{imported && <div className="swap-import"><h3>{imported.symbol}</h3><p>{imported.name}</p><code>{imported.address}</code><p>未收录资产。元数据读取成功不代表安全或可交易，请核对合约。</p><label><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} />我已核对合约地址</label><button className="swap-primary" disabled={!accepted} onClick={() => onSelect(imported)}>导入并选择</button></div>}{!visible.length && !busy && !imported && !error && <p className="swap-dialog-description">没有匹配资产。可以切换全部资产或粘贴完整合约。</p>}</ProductDialog>
}
