import {useEffect,useRef,useState} from 'react'
import {createChart,CandlestickSeries,AreaSeries,ColorType,type UTCTimestamp} from 'lightweight-charts'
import type {SwapToken} from './config'
import {TokenIcon} from './TokenIcon'
import {CHART_PERIODS,type ChartSnapshot} from './chartData'
import {usd,percent,type TokenMarket} from './marketData'

export function MarketChart({token,market}:{token:SwapToken;market?:TokenMarket}){
 const [period,setPeriod]=useState<keyof typeof CHART_PERIODS>('1h')
 const [mode,setMode]=useState<'candles'|'line'>('candles')
 const [snapshot,setSnapshot]=useState<ChartSnapshot|null>(null)
 const [error,setError]=useState(''),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0)
 const holder=useRef<HTMLDivElement>(null)
 useEffect(()=>{
  const timer=setInterval(()=>{if(!document.hidden)setRefresh(n=>n+1)},60000);return()=>clearInterval(timer)
 },[])
 useEffect(()=>{
  const abort=new AbortController();setSnapshot(null);setLoading(true);setError('')
  fetch(`/api/swap-chart?token=${token.address}&period=${period}`,{signal:abort.signal}).then(async response=>{
   if(!response.ok)throw Error('行情暂不可用')
   const body=await response.json() as ChartSnapshot
   if(body.token!==token.address.toLowerCase()||!Array.isArray(body.candles)||!body.candles.length)throw Error('行情数据不匹配')
   if(!abort.signal.aborted)setSnapshot(body)
  }).catch(()=>{if(!abort.signal.aborted)setError('暂时没有可用的历史行情，仍可在右侧查询兑换报价。')}).finally(()=>{if(!abort.signal.aborted)setLoading(false)})
  return()=>abort.abort()
 },[token.address,period,refresh])
 useEffect(()=>{
  if(!holder.current||!snapshot)return
  const chart=createChart(holder.current,{autoSize:true,height:340,layout:{background:{type:ColorType.Solid,color:'#ffffff'},textColor:'#7c778b',attributionLogo:true},grid:{vertLines:{color:'#f4f2f8'},horzLines:{color:'#f4f2f8'}},rightPriceScale:{borderVisible:false},timeScale:{borderVisible:false,timeVisible:period!=='1d'},localization:{priceFormatter:(price:number)=>price.toLocaleString('en-US',{maximumSignificantDigits:7})}})
  if(mode==='candles')chart.addSeries(CandlestickSeries,{upColor:'#159c7c',downColor:'#e55776',wickUpColor:'#159c7c',wickDownColor:'#e55776',borderVisible:false}).setData(snapshot.candles.map(c=>({...c,time:c.time as UTCTimestamp})))
  else chart.addSeries(AreaSeries,{lineColor:'#763cea',topColor:'#763cea33',bottomColor:'#763cea00'}).setData(snapshot.candles.map(c=>({time:c.time as UTCTimestamp,value:c.close})))
  chart.timeScale().fitContent();return()=>chart.remove()
 },[snapshot,mode,period])
 const price=snapshot?.candles.at(-1)?.close
 return <section className="swap-chart-card" aria-label={`${token.symbol} 美元行情`}>
  <div className="swap-chart-heading"><div className="swap-chart-token"><TokenIcon token={token}/><div><h1>{token.symbol} <span>/ USD</span></h1><p>{token.name}</p></div></div><span className="swap-chart-network">BNB CHAIN</span></div>
  <div className="swap-chart-price"><strong>{price==null?'—':`$${price.toLocaleString('en-US',{maximumSignificantDigits:7})}`}</strong><span className={(market?.change24h??0)<0?'negative':'positive'}>{percent(market?.change24h)} <small>24h</small></span></div>
  <div className="swap-chart-controls"><div aria-label="K线周期">{Object.keys(CHART_PERIODS).map(p=><button key={p} aria-pressed={p===period} onClick={()=>setPeriod(p as typeof period)}>{p}</button>)}</div><div><button aria-label="显示K线" aria-pressed={mode==='candles'} onClick={()=>setMode('candles')}>K线</button><button aria-label="显示价格曲线" aria-pressed={mode==='line'} onClick={()=>setMode('line')}>曲线</button></div></div>
  <div className="swap-chart-canvas" ref={holder}>{!snapshot&&<div className="swap-chart-empty" role="status"><span>↗</span><strong>{loading?'正在读取链上行情…':'历史行情暂不可用'}</strong><p>{error||'按所选资产查询真实池子数据'}</p>{error&&<button onClick={()=>setRefresh(n=>n+1)}>重新加载</button>}</div>}</div>
  <div className="swap-chart-stats"><div><span>24h 成交额</span><strong>{usd(market?.volume24h,true)}</strong></div><div><span>参考池流动性</span><strong>{usd(market?.liquidityUsd,true)}</strong></div><div><span>市场参考池</span><strong>{market?`${market.dex} ${market.protocol}`:'—'}</strong></div></div>
  <div className="swap-chart-source"><span>历史数据 <a href="https://www.geckoterminal.com/" target="_blank" rel="noreferrer">GeckoTerminal</a> · 图表 <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">TradingView</a></span>{snapshot&&<a href={`https://bscscan.com/address/${snapshot.pool}`} target="_blank" rel="noreferrer">查看行情池 ↗</a>}</div>
  <p className="swap-chart-disclaimer">美元历史行情仅供参考，实际兑换数量以右侧链上报价为准。24h 数据来自 DEX Screener 的参考池，可能与历史行情池不同。</p>
 </section>
}
