import { useEffect, useRef, useState } from 'react'
import './market-dashboard.css'
import { WatchlistTransfer } from './WatchlistTransfer'
import { swapHref, STOCK_TOKENS, stockSwapHref } from '../swap/config'
import { stocks, indexEtfs, instruments, validSymbol as valid } from '../markets/data'
import { EquitySourceLinks, NativeChart, NativeHeatmap, NativeOverview, useEquityData } from '../markets/NativeMarkets'

const key = 'flap-stock-watchlist-v1'
function readSaved(): string[] {
  try { const data: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(data) ? [...new Set(data.filter(valid))].slice(0, 30) : [] } catch { return [] }
}
function readSymbol() {
  const params = new URLSearchParams(window.location.search)
  // TradingView appends this parameter to the site's custom chart URL.
  const widgetSymbol = params.get('tvwidgetsymbol')
  const symbol = params.get('symbol')
  return valid(widgetSymbol) ? widgetSymbol : valid(symbol) ? symbol : 'NASDAQ:AAPL'
}
function Widget({ kind, config, title }: { kind: string; config: Record<string, unknown>; title: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!host.current) return
    if (!('IntersectionObserver' in window)) { setVisible(true); return }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect() }
    }, { rootMargin: '200px' })
    observer.observe(host.current)
    return () => observer.disconnect()
  }, [])
  const [retry, setRetry] = useState(0)
  const [slow, setSlow] = useState(false)
  const [mounted, setMounted] = useState(false)
  const serialized = JSON.stringify(config)
  useEffect(() => {
    const parent = host.current
    if (!parent || !visible) return
    setSlow(false); setMounted(false)
    const container = document.createElement('div')
    container.className = 'tradingview-widget-container'
    container.style.cssText = 'height:100%;width:100%'
    const mount = document.createElement('div')
    mount.className = 'tradingview-widget-container__widget'
    mount.style.cssText = 'height:100%;width:100%'
    container.appendChild(mount)
    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-' + kind + '.js'
    script.async = true
    script.textContent = serialized
    script.onerror = () => setSlow(true)
    parent.appendChild(container)
    container.appendChild(script)
    const timer = window.setTimeout(() => setSlow(true), 15000)
    const observer = new MutationObserver(() => {
      const frame = container.querySelector('iframe')
      if (frame) { setMounted(true); frame.title = title; window.clearTimeout(timer) }
    })
    observer.observe(container, { childList: true, subtree: true })
    return () => { script.onerror = null; window.clearTimeout(timer); observer.disconnect(); container.remove() }
  }, [kind, serialized, retry, title, visible])
  return <div className="market-widget-wrap">
    <div className="market-widget-stage"><div className="market-widget" ref={host} />{!mounted && <div className="market-widget-placeholder" role="status"><span>蝴蝶股票</span><p>{slow ? '暂时未能加载，请重试' : visible ? '正在连接行情来源…' : '滚动到此处加载行情'}</p></div>}</div>
    <div className="market-widget-footer">
      <a href={kind === 'stock-heatmap' ? 'https://www.tradingview.com/heatmap/stock/' : 'https://www.tradingview.com/markets/stocks-usa/'} target="_blank" rel="noopener nofollow noreferrer">行情与图表 by TradingView</a>
      <button type="button" onClick={() => setRetry(n => n + 1)}>重新加载</button>
    </div>
    {slow && <p role="status">行情加载较慢，请重新加载或打开上方数据来源查看。</p>}
  </div>
}
export function MarketDashboard() {
  const [selected, setSelected] = useState(readSymbol)
  // Default loads no third-party scripts/iframes; the advanced view is opt-in.
  const [advanced, setAdvanced] = useState(false)
  const equityData = useEquityData(undefined, !advanced)
  const searchRef = useRef<HTMLInputElement>(null)
  // The widget appends '?tvwidgetsymbol=…', so use a query-free URL.
  // App recognizes that parameter as a market-page entry on either domain.
  const chartUrl = new URL('/', window.location.origin).href
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('tvwidgetsymbol')) {
      document.getElementById('market-chart')?.scrollIntoView({ block: 'start' })
    }
  }, [])
  useEffect(() => {
    const onBack = () => { setSelected(readSymbol()); setMessage(''); setShareUrl('') }
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); searchRef.current?.focus(); searchRef.current?.select()
      }
    }
    window.addEventListener('popstate', onBack)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('popstate', onBack); window.removeEventListener('keydown', onKey) }
  }, [])
  useEffect(() => { document.title = selected + ' · 美股动态 · 蝴蝶股票' }, [selected])
  const [query, setQuery] = useState('')
  const [saved, setSaved] = useState(readSaved)
  const [message, setMessage] = useState('')
  const [watchMessage, setWatchMessage] = useState('')
  const [offline, setOffline] = useState(!navigator.onLine)
  useEffect(() => {
    const onNetwork = () => setOffline(!navigator.onLine)
    const onStorage = (event: StorageEvent) => { if (event.key === key || event.key === null) setSaved(readSaved()) }
    window.addEventListener('online', onNetwork); window.addEventListener('offline', onNetwork); window.addEventListener('storage', onStorage)
    document.body.classList.add('market-route')
    return () => { window.removeEventListener('online', onNetwork); window.removeEventListener('offline', onNetwork); window.removeEventListener('storage', onStorage); document.body.classList.remove('market-route') }
  }, [])
  const [tab, setTab] = useState<'overview' | 'movers'>('overview')
  const results = (query.trim() ? instruments : stocks).filter(s => (s.symbol + ' ' + s.name).toLowerCase().includes(query.trim().toLowerCase()))
  const name = instruments.find(s => s.symbol === selected)?.name ?? selected
  const linkedTokens = STOCK_TOKENS.filter(t => t.stockSymbol === selected.split(':')[1])
  const isSaved = saved.includes(selected)
  const updateSaved = (next: string[]) => {
    setSaved(next)
    try { localStorage.setItem(key, JSON.stringify(next)); setWatchMessage('自选已保存在当前浏览器') }
    catch { setWatchMessage('浏览器无法保存，自选仅在本次页面有效；请生成备份') }
  }
  const choose = (symbol: string) => {
    if (symbol !== selected || new URLSearchParams(window.location.search).has('tvwidgetsymbol')) {
      const url = new URL(window.location.href)
      // Otherwise the embedding script can override a later stock selection.
      url.searchParams.delete('tvwidgetsymbol')
      url.searchParams.set('view', 'markets')
      url.searchParams.set('symbol', symbol)
      window.history.pushState(null, '', url)
    }
    setSelected(symbol); setMessage(''); setShareUrl('')
  }
  const shareStock = async () => {
    const url = new URL(window.location.href)
    url.search = ''; url.hash = ''
    url.searchParams.set('view', 'markets'); url.searchParams.set('symbol', selected)
    try {
      await navigator.clipboard.writeText(url.toString())
      setMessage('股票链接已复制，朋友打开后可直接查看 ' + selected)
    } catch { setMessage('无法自动复制，请复制下方股票链接') }
    setShareUrl(url.toString())
  }
  const [shareUrl, setShareUrl] = useState('')

  return <div className="market-page">
    <a className="market-skip" href="#market-chart">跳到股票行情</a>
    <header className="market-header">
      <a className="market-brand" href="/"><img src="/flap-stock-avatar.png" alt="" /><span>蝴蝶股票<small>FLAP STOCK</small></span></a>
      <div><a href="/">项目首页</a><a href="#market-chart">美股动态</a><a href={swapHref()}>蝴蝶swap</a><a href="#market-watchlist">我的自选</a><a href="#market-map">涨跌热力图</a></div>
    </header>
    <main className="market-main">
      {offline && <p className="market-offline" role="status">当前网络已断开。显示的数据可能是之前加载的内容；恢复连接后可点击对应区域的“重新加载”。</p>}
      <section className="market-intro">
        <div><p className="market-kicker">FLAP STOCK / US MARKETS</p><h1>看见美股<span>正在发生的变化。</span></h1><p>价格、走势与市场动向，一个页面轻松查看。</p></div>
        <div className="market-data-note"><strong>美股动态 · {advanced ? 'TradingView 高级版' : '本站行情'}</strong><p>{advanced ? '数据由 TradingView 提供，加载受所在网络影响。加载较慢时，可切回本站行情。' : '行情来源：腾讯行情。价格与走势直接在本页展示，美股报价可能延迟，请留意纽约时间与行情日期。'}</p><span>无需连接钱包 · 不提供股票交易</span></div>
      </section>
      <div className="market-view-switch" aria-label="行情显示方式"><button type="button" aria-pressed={!advanced} onClick={() => setAdvanced(false)}>本站行情</button><button type="button" aria-pressed={advanced} onClick={() => setAdvanced(true)}>TradingView 高级版</button><span>{advanced ? '包含全市场热力图与新闻，需能连接 TradingView。' : '股票、ETF 与历史走势，手机电脑共用。'}</span></div>
      <nav className="market-quicknav" aria-label="看板快捷导航"><a href="#market-chart">查股票</a><a href="#market-watchlist">看自选</a><a href="#market-map">看涨跌</a><a href="#market-news">读新闻</a></nav>
      <div className="market-layout">
        <section className="market-panel market-main-chart" id="market-chart">
          <div className="market-section-head"><div><p className="market-kicker">01 / STOCK EXPLORER</p><h2>股票行情</h2></div><span className="market-badge">{advanced ? '价格单位以图表为准' : '美元 USD · 可能延迟'}</span></div>
          <form className="market-search" onSubmit={e => { e.preventDefault(); const symbol = query.trim().toUpperCase(); if (valid(symbol)) choose(symbol); else if (results.length === 1) choose(results[0].symbol); else setMessage('请选择搜索结果，或输入完整代码，例如 NYSE:IBM') }}>
            <label htmlFor="stock-search">搜索常用股票，或输入交易所代码 <kbd>Ctrl / ⌘ K</kbd></label>
            <div><input ref={searchRef} id="stock-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="苹果 / AAPL / NYSE:IBM" maxLength={40} /><button type="submit">查看</button></div>
          </form>
          <div className="market-stock-buttons">{results.map(s => <button type="button" key={s.symbol} aria-pressed={selected === s.symbol} onClick={() => choose(s.symbol)} title={s.name}>{s.symbol.split(':')[1]}<small>{s.name.split(' ')[0]}</small></button>)}</div>
          {query && results.length === 0 && <p className="market-help">未匹配常用列表？可输入 NASDAQ:代码、NYSE:代码或 AMEX:代码查询，是否支持以图表结果为准。</p>}
          <div className="market-selected"><div><strong>{name}</strong><small>{selected}</small></div><button type="button" disabled={!isSaved && saved.length >= 30} aria-pressed={isSaved} onClick={() => updateSaved(isSaved ? saved.filter(s => s !== selected) : [...saved, selected])}>{isSaved ? '★ 移出自选' : '☆ 加入自选'}</button></div>
          {linkedTokens.length > 0 && <div className="market-chain-links"><strong>对应链上代币 · BNB Chain</strong>{linkedTokens.map(t => <a key={t.address} href={stockSwapHref(t)}><img src={t.logoURI} alt="" />{t.symbol} · 在蝴蝶swap查看 ↗</a>)}<small>美股行情与链上兑换报价不同，代币不等同于直接持有股票。</small></div>}
          <div className="market-share-row"><button type="button" onClick={shareStock}>分享这只股票 ↗</button><p className="market-feedback" role="status">{message}</p></div>
          {shareUrl && <label className="market-share-link">股票分享链接<input readOnly value={shareUrl} onFocus={e => e.currentTarget.select()} /></label>}
          {advanced ? <Widget title="股票价格走势图" kind="advanced-chart" config={{ autosize: true, symbol: selected, interval: 'D', timezone: 'America/New_York', theme: 'light', style: '1', locale: 'zh_CN', allow_symbol_change: false, withdateranges: true, hide_side_toolbar: true, save_image: false, calendar: false, support_host: 'https://www.tradingview.com' }} /> : <NativeChart symbol={selected} />}
        </section>
        <aside className="market-sidebar">
          <section className="market-panel" id="market-watchlist">
            <p className="market-kicker">02 / MY WATCHLIST</p><h2>我的自选 <small>{saved.length}/30</small></h2>
            <p className="market-help">保存在当前浏览器，点击股票查看走势。</p>
            {saved.length === 0 ? <div className="market-empty">还没有自选股票。<br />选中股票后，点击“加入自选”。</div> : <ul className="market-saved">{saved.map(s => <li key={s}><button type="button" onClick={() => choose(s)}>{s.split(':')[1]}<small>{instruments.find(v => v.symbol === s)?.name ?? s}</small></button><button type="button" aria-label={'移除 ' + s} onClick={() => updateSaved(saved.filter(v => v !== s))}>×</button></li>)}</ul>}
            <p className="market-feedback" role="status">{watchMessage}</p>
            <WatchlistTransfer saved={saved} onMerge={updateSaved} />
          </section>
          <section className="market-panel market-overview">
            <div className="market-tabs"><button type="button" aria-pressed={tab === 'overview'} onClick={() => setTab('overview')}>大盘参考</button><button type="button" aria-pressed={tab === 'movers'} onClick={() => setTab('movers')}>涨跌榜</button></div>
            {!advanced ? <NativeOverview state={equityData} movers={tab === 'movers'} choose={choose} /> : tab === 'overview' ? <><p className="market-help">下列为跟踪主要指数的 ETF，显示 ETF 价格，并非指数点位。点击代码或图标，在本站查看走势。</p><Widget title="大盘 ETF 行情" kind="market-overview" config={{ largeChartUrl: chartUrl, colorTheme: 'light', dateRange: '1D', locale: 'zh_CN', width: '100%', height: '100%', showChart: false, showSymbolLogo: true, isTransparent: false, tabs: [{title: '指数 ETF', symbols: indexEtfs.map(({ symbol, name }) => ({ s: symbol, d: name }))}] }} /></> : <><p className="market-help">美国市场涨幅、跌幅与活跃股票，按数据源更新。</p><Widget title="美国股票涨跌榜" kind="hotlists" config={{ largeChartUrl: chartUrl, colorTheme:'light',dateRange:'1D',exchange:'US',showChart:false,locale:'zh_CN',width:'100%',height:'100%',isTransparent:false,showSymbolLogo:true,showFloatingTooltip:true }} /></>}
          </section>
        </aside>
      </div>
      <section className="market-panel market-heatmap" id="market-map">
        <div className="market-section-head"><div><p className="market-kicker">03 / MARKET MAP</p><h2>{advanced ? '今天，哪些板块在变？' : '关注股票，涨跌一眼看见。'}</h2></div><span className="market-badge">{advanced ? '标普 500 成分股' : '七姐妹 + 3 只常用股票'}</span></div>
        <p className="market-help">{advanced ? '按行业分组：方块大小代表市值，颜色代表当日涨跌幅。绿色上涨、红色下跌，具体数值可在图中查看。数据可能延迟。' : '仅展示本站 10 只常用股票，方块等大，不代表市值或全市场板块。绿色上涨、红色下跌；点击查看股票走势。'}</p>
        {advanced ? <Widget kind="stock-heatmap" title="标普500板块热力图" config={{ dataSource: 'SPX500', blockSize: 'market_cap_basic', blockColor: 'change', grouping: 'sector', locale: 'zh_CN', symbolUrl: '', colorTheme: 'light', exchanges: [], hasTopBar: false, isDataSetEnabled: false, isZoomEnabled: true, hasSymbolTooltip: true, isMonoSize: false, width: '100%', height: '100%' }} /> : <NativeHeatmap state={equityData} choose={symbol => { choose(symbol); document.getElementById('market-chart')?.scrollIntoView({ block: 'start', behavior: 'smooth' }) }} />}
      </section>
      <section className="market-panel market-news" id="market-news">
        <div className="market-section-head"><div><p className="market-kicker">04 / COMPANY NEWS</p><h2>{name} · 相关新闻</h2></div><span className="market-badge">{selected}</span></div>
        <p className="market-help">{advanced ? '随所选股票切换；新闻语言、发布时间与可用内容以来源为准。没有新闻不代表公司没有动态。' : '打开国内财经网站查看原文与发布时间。切换股票后，腾讯入口会跟随更新。'}</p>
        {advanced ? <Widget title={name + '相关新闻'} kind="timeline" config={{ feedMode: 'symbol', symbol: selected, displayMode: 'regular', colorTheme: 'light', isTransparent: false, locale: 'zh_CN', width: '100%', height: '100%' }} /> : <EquitySourceLinks symbol={selected} />}
      </section>
      <footer className="market-disclaimer"><strong>关于这里的数据</strong><p>本站行情来源于腾讯公开行情，可能延迟或中断；页面每分钟尝试刷新。行情日期采用纽约时间，获取时间采用北京时间，休市期间可能显示最近交易日数据。历史图表仅含日线。TradingView 高级版的覆盖、延迟以组件信息为准。美股报价与链上代币价格分别展示；网络异常时不会用模拟数字补位。</p><a href="https://gu.qq.com/" target="_blank" rel="noopener noreferrer">腾讯行情来源 ↗</a><a href="https://www.tradingview.com/widget-docs/markets/north-america/" target="_blank" rel="noopener noreferrer">TradingView 数据说明 ↗</a><a href="/">返回蝴蝶股票官网 ↗</a></footer>
    </main>
  </div>
}
