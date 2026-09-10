import { useEffect, useState } from 'react'
import { indexEtfs, instruments, sourceLink, stocks, type EquityResponse, type DailyBar } from './data'

export function useEquityData(symbol?: string, enabled = true) {
  const url = '/api/us-markets' + (symbol ? '?symbol=' + encodeURIComponent(symbol) : '')
  const [state, setState] = useState<{ url: string; data?: EquityResponse; error?: string; loading: boolean }>({ url, loading: true })
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let disposed = false, pending = false
    let controller: AbortController | undefined
    const update = async () => {
      if (pending) return
      pending = true
      const request = new AbortController()
      controller = request
      setState(s => ({ url, data: s.url === url ? s.data : undefined, loading: true }))
      const timeout = window.setTimeout(() => request.abort(), 12000)
      try {
        const res = await fetch(url, { signal: request.signal })
        if (!res.ok) throw new Error('行情暂时不可用，请重试或打开数据来源。')
        const data = await res.json() as EquityResponse
        if (data.source !== '腾讯行情' || !Number.isFinite(data.fetchedAt) || (symbol ? data.history?.symbol !== symbol : !Array.isArray(data.quotes))) throw new Error('行情返回异常，请稍后重试。')
        if (!disposed) setState({ url, data, loading: false })
      } catch {
        if (!disposed) setState(s => ({ url, data: s.url === url ? s.data : undefined, loading: false, error: '行情暂时未能更新，请重试或打开腾讯行情。' }))
      } finally { window.clearTimeout(timeout); pending = false }
    }
    void update()
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void update() }, 60000)
    const reconnect = () => { if (document.visibilityState === 'visible') void update() }
    window.addEventListener('online', reconnect)
    return () => { disposed = true; controller?.abort(); window.clearInterval(interval); window.removeEventListener('online', reconnect) }
  }, [url, revision, symbol, enabled])
  const current = state.url === url ? state : { loading: true, data: undefined, error: undefined }
  return { ...current, reload: () => setRevision(n => n + 1) }
}
export const priceText = (n: number | null | undefined) => n == null ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const percentText = (n: number | null | undefined) => n == null ? '暂无涨跌数据' : (n > 0 ? '+' : '') + n.toFixed(2) + '%'
const changeClass = (n: number | null | undefined) => n == null || n === 0 ? 'equity-flat' : n > 0 ? 'equity-up' : 'equity-down'
function FetchTime({ timestamp }: { timestamp?: number }) {
  return timestamp ? <span>获取于 {new Date(timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}（北京时间）</span> : null
}
function SourceStatus({ data, error, loading, reload, symbol }: ReturnType<typeof useEquityData> & { symbol?: string }) {
  return <div className="equity-source">
    {error && <p role="status">{error}{data ? ' 下方保留上次取得的数据，请核对行情日期。' : ''}</p>}
    {!data && loading && <p role="status">正在获取美股行情…</p>}
    <div><a href={sourceLink(symbol ?? 'NASDAQ:AAPL')} target="_blank" rel="noopener noreferrer">腾讯行情 ↗</a><button type="button" onClick={reload} disabled={loading}>{loading ? '获取中…' : '刷新行情'}</button></div>
    <FetchTime timestamp={data?.fetchedAt} />
  </div>
}
export function NativeChart({ symbol }: { symbol: string }) {
  const state = useEquityData(symbol)
  const [period, setPeriod] = useState(63)
  const [style, setStyle] = useState<'line' | 'candle'>('line')
  const [cursor, setCursor] = useState<number | null>(null)
  useEffect(() => setCursor(null), [symbol, period, style])
  const history = state.data?.history
  const quote = history?.quote
  const bars = (history?.bars ?? []).slice(-period)
  const active = bars[cursor === null ? bars.length - 1 : Math.min(cursor, bars.length - 1)]
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  return <div className="equity-chart" aria-label="本站美股行情">
    {quote ? <>
      <div className="equity-price"><strong>${priceText(quote.price)}</strong><span className={changeClass(quote.changePercent)}>{quote.change != null && (quote.change > 0 ? '+' : '') + priceText(quote.change)} · {percentText(quote.changePercent)}</span></div>
      <p className="market-help">行情时间：{quote.asOf}（纽约时间）{history?.marketState && ' · ' + history.marketState} · 可能延迟</p>
      {quote.asOf.slice(0, 10) < today && <p className="market-help">显示最近取得的交易日行情，可能处于休市或数据尚未更新。</p>}
      <dl className="equity-stats"><div><dt>昨收</dt><dd>{priceText(quote.previousClose)}</dd></div><div><dt>开盘</dt><dd>{priceText(quote.open)}</dd></div><div><dt>最高</dt><dd>{priceText(quote.high)}</dd></div><div><dt>最低</dt><dd>{priceText(quote.low)}</dd></div></dl>
    </> : state.data && <p role="status">当前报价暂缺，请参考下方历史日期。</p>}
    <div className="equity-chart-controls"><div aria-label="走势时间范围">{[[21, '1个月'], [63, '3个月'], [126, '6个月']].map(([n, label]) => <button key={n} type="button" aria-pressed={period === n} onClick={() => setPeriod(Number(n))}>{label}</button>)}</div><div aria-label="图表类型"><button type="button" aria-pressed={style === 'line'} onClick={() => setStyle('line')}>走势</button><button type="button" aria-pressed={style === 'candle'} onClick={() => setStyle('candle')}>日 K</button></div></div>
    {bars.length >= 2 ? <>
      <DailyChart bars={bars} style={style} cursor={cursor} onCursor={setCursor} />
      <div className="equity-chart-dates"><span>{bars[0].date}</span><span>{bars.at(-1)?.date}</span></div>
      <label className="equity-date-slider">查看交易日<input type="range" min={0} max={bars.length - 1} value={cursor ?? bars.length - 1} onChange={e => setCursor(Number(e.target.value))} aria-valuetext={active?.date} /></label>
      {active && <div className="equity-day-details" aria-live="polite"><strong>{active.date}</strong><span>开 {priceText(active.open)}</span><span>收 {priceText(active.close)}</span><span>高 {priceText(active.high)}</span><span>低 {priceText(active.low)}</span></div>}
    </> : <div className="equity-chart-empty" role="status">{state.loading ? '正在加载历史走势…' : '历史数据不足，暂不绘制走势。'}</div>}
    <p className="market-help">美元 USD · 日线{history?.adjustment === 'qfq' ? '前复权' : '不复权'} · 绿色上涨 / 红色下跌。所选区间显示最近交易日，图表不包含盘前盘后走势。</p>
    <SourceStatus {...state} symbol={symbol} />
  </div>
}
function DailyChart({ bars, style, cursor, onCursor }: { bars: DailyBar[]; style: 'line' | 'candle'; cursor: number | null; onCursor: (n: number | null) => void }) {
  const min = Math.min(...bars.map(b => style === 'candle' ? b.low : b.close))
  const max = Math.max(...bars.map(b => style === 'candle' ? b.high : b.close))
  const padding = Math.max((max - min) * .12, max * .002, .01)
  const bottom = min - padding, top = max + padding
  const x = (i: number) => 12 + i * 654 / (bars.length - 1)
  const y = (n: number) => 16 + (top - n) / (top - bottom) * 268
  const color = bars.at(-1)!.close >= bars[0].close ? '#087856' : '#bb364b'
  const path = bars.map((b, i) => `${i ? 'L' : 'M'}${x(i)},${y(b.close)}`).join(' ')
  return <svg className="equity-svg" viewBox="0 0 750 304" role="img" aria-label={`${bars[0].date} 至 ${bars.at(-1)?.date} 的${style === 'line' ? '收盘价走势' : '日 K 线'}，价格单位美元`}
    onPointerMove={e => { const r = e.currentTarget.getBoundingClientRect(); onCursor(Math.max(0, Math.min(bars.length - 1, Math.round(((e.clientX - r.left) / r.width * 750 - 12) / 654 * (bars.length - 1))))) }} onPointerLeave={() => onCursor(null)}>
    {[0, 1, 2, 3, 4].map(i => { const v = bottom + (top - bottom) * i / 4; return <g key={i}><line x1="0" y1={y(v)} x2="680" y2={y(v)} stroke="#eae5f0" /><text x="690" y={y(v) + 4} fill="#71647c" fontSize="12">{priceText(v)}</text></g> })}
    {style === 'line' ? <><path d={path + ` L${x(bars.length - 1)},284 L12,284 Z`} fill={color} opacity=".07" /><path d={path} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" /></> : bars.map((b, i) => { const fill = b.close >= b.open ? '#087856' : '#bb364b'; const width = Math.max(2, 440 / bars.length); return <g key={b.date}><line x1={x(i)} x2={x(i)} y1={y(b.high)} y2={y(b.low)} stroke={fill} /><rect x={x(i) - width / 2} y={Math.min(y(b.open), y(b.close))} width={width} height={Math.max(1, Math.abs(y(b.open) - y(b.close)))} fill={fill} /></g> })}
    {cursor !== null && bars[cursor] && <g><line x1={x(cursor)} x2={x(cursor)} y1="10" y2="288" stroke="#5b20ff" strokeDasharray="4 4" /><circle cx={x(cursor)} cy={y(bars[cursor].close)} r="4" fill="#5b20ff" /></g>}
  </svg>
}
export function NativeOverview({ movers, choose, state }: { movers: boolean; choose: (s: string) => void; state: ReturnType<typeof useEquityData> }) {
  const quotes = state.data?.quotes ?? []
  const rows = movers ? stocks.map(s => ({ ...s, quote: quotes.find(q => q.symbol === s.symbol) })).sort((a, b) => (b.quote?.changePercent ?? -Infinity) - (a.quote?.changePercent ?? -Infinity)) : indexEtfs.map(s => ({ ...s, quote: quotes.find(q => q.symbol === s.symbol) }))
  return <><p className="market-help">{movers ? '仅比较本站 10 只常用股票，按当日涨跌幅排序，并非全市场排行。' : '显示跟踪指数的 ETF 价格，并非指数点位。点击查看走势。'}</p><div className="equity-overview">{rows.map(s => <button type="button" key={s.symbol} onClick={() => choose(s.symbol)}><span><strong>{s.symbol.split(':')[1]}</strong><small>{s.name}</small></span><span><strong>{s.quote ? '$' + priceText(s.quote.price) : '—'}</strong><small className={changeClass(s.quote?.changePercent)}>{percentText(s.quote?.changePercent)}</small><small>{s.quote?.asOf.slice(0, 16)}{s.quote && ' 纽约'}</small></span></button>)}</div><SourceStatus {...state} /></>
}
export function NativeHeatmap({ state, choose }: { state: ReturnType<typeof useEquityData>; choose: (s: string) => void }) {
  return <><div className="equity-heatmap">{stocks.map(stock => { const quote = state.data?.quotes?.find(q => q.symbol === stock.symbol); return <button type="button" key={stock.symbol} className={changeClass(quote?.changePercent)} onClick={() => choose(stock.symbol)}><strong>{stock.symbol.split(':')[1]}</strong><span>{stock.name.split(' ')[0]}</span><b>{percentText(quote?.changePercent)}</b><small>{quote ? '$' + priceText(quote.price) : '报价暂缺'}</small></button> })}</div><p className="market-help">各股票更新时间可能不同，以所选股票的行情日期为准。</p></>
}
export function EquitySourceLinks({ symbol }: { symbol: string }) {
  const name = instruments.find(s => s.symbol === symbol)?.name ?? symbol
  return <div className="equity-news-links"><a href={sourceLink(symbol)} target="_blank" rel="noopener noreferrer">{name} · 腾讯行情与资讯 ↗</a><a href="https://finance.eastmoney.com/" target="_blank" rel="noopener noreferrer">东方财富 · 财经资讯 ↗</a></div>
}
