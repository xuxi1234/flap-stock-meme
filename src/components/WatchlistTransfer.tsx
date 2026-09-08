import { useState } from 'react'

export function parseWatchlist(text: string): string[] {
  if (text.length > 16000) throw new Error('内容过长，请只导入自选名单')
  let data: unknown
  try { data = JSON.parse(text) } catch { throw new Error('格式不正确，请粘贴完整的备份内容') }
  const record = data as { version?: unknown; symbols?: unknown } | null
  if (!record || record.version !== 1 || !Array.isArray(record.symbols)) throw new Error('请使用蝴蝶股票导出的自选备份')
  if (!record.symbols.every((s: unknown) => typeof s === 'string' && /^(NASDAQ|NYSE|AMEX):[A-Z0-9.\-]{1,16}$/.test(s))) throw new Error('名单中存在无效股票代码')
  const symbols = [...new Set(record.symbols)] as string[]
  if (!symbols.length || symbols.length > 30) throw new Error('备份需要包含 1–30 只股票')
  return symbols
}

export function WatchlistTransfer({ saved, onMerge }: { saved: string[]; onMerge: (symbols: string[]) => void }) {
  const [text, setText] = useState('')
  const [feedback, setFeedback] = useState('')
  return <details className="watchlist-transfer">
    <summary>备份与导入自选</summary>
    <p className="market-help">复制备份可带到其他手机或浏览器。仅包含股票代码，导入会合并到现有自选。</p>
    <button type="button" disabled={!saved.length} onClick={() => {
      setText(JSON.stringify({ version: 1, symbols: saved }, null, 2))
      setFeedback('备份已生成，请复制下方内容并保存')
    }}>生成备份</button>
    <label>自选备份内容<textarea value={text} onChange={e => setText(e.target.value)} maxLength={16000} rows={4} placeholder="在此粘贴完整的自选备份" /></label>
    <div className="market-transfer-actions">
      <button type="button" disabled={!text.trim()} onClick={async () => {
        try { await navigator.clipboard.writeText(text); setFeedback('已复制备份内容') }
        catch { setFeedback('请长按或全选上方内容，手动复制') }
      }}>复制内容</button>
      <button type="button" disabled={!text.trim()} onClick={() => {
        try {
          const imported = parseWatchlist(text)
          const merged = [...new Set([...saved, ...imported])]
          if (merged.length > 30) throw new Error('合并后超过 30 只，请先整理自选再导入')
          onMerge(merged)
          setFeedback('已合并 ' + (merged.length - saved.length) + ' 只新股票')
        } catch (error) { setFeedback(error instanceof Error ? error.message : '导入失败，请检查备份内容') }
      }}>合并导入</button>
    </div>
    <p className="market-help" role="status">{feedback}</p>
  </details>
}
