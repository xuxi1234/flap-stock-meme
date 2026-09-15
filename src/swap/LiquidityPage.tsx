import { useEffect, useRef, useState } from 'react'
import { formatUnits, isAddress, zeroAddress, type Address, type Hash, type PublicClient, type WalletClient } from 'viem'
import { ROUTER, TOKENS, tokenKey, type SwapToken } from './config'
import { displayAmount, friendlySwapError, parseAmount, readBalance } from './service'
import { approveLiquidity, buildLiquidityReview, executeLiquidity, liquidityAllowance, readPool, sameAsset, writeRestriction, type LiquidityReview, type PoolPosition } from './liquidity'
import { ProductDialog, TokenPicker } from './TokenPicker'
import { TokenIcon } from './TokenIcon'

type Props = { client: PublicClient; wallet: WalletClient | null; account: Address | null; onConnect: () => void; onBusy: (busy:boolean) => void }
type Pending = { hash:Hash; account:Address; label:string; status:'pending'|'success'|'reverted'|'cancelled'|'replaced' }
const key='butterfly-liquidity-transactions-v1'
function savedTransactions(): Pending[] {try{const v=JSON.parse(localStorage.getItem(key)??'[]');return Array.isArray(v)?v.filter(t=>/^0x[\da-f]{64}$/i.test(t.hash)&&isAddress(t.account)&&typeof t.label==='string'&&['pending','success','reverted','cancelled','replaced'].includes(t.status)).slice(0,20):[]}catch{return []}}

export function LiquidityPage({client,wallet,account,onConnect,onBusy}:Props) {
  const [mode,setMode]=useState<'add'|'remove'>('add')
  const [a,setA]=useState(TOKENS[0]),[b,setB]=useState(TOKENS[1])
  const [picker,setPicker]=useState<'a'|'b'|null>(null)
  const [value,setValue]=useState(''),[side,setSide]=useState<'a'|'b'>('a')
  const [percent,setPercent]=useState(25),[slippage,setSlippage]=useState(50)
  const [pool,setPool]=useState<PoolPosition|null>(null)
  const [balances,setBalances]=useState<[bigint,bigint]|null>(null)
  const [refresh,setRefresh]=useState(0),[loading,setLoading]=useState(false)
  const [error,setError]=useState(''),[message,setMessage]=useState('')
  const [review,setReview]=useState<LiquidityReview|null>(null)
  const [allowances,setAllowances]=useState<Awaited<ReturnType<typeof liquidityAllowance>>|null>(null)
  const [busy,setBusy]=useState(false),[clock,setClock]=useState(Date.now())
  const [transactions,setTransactions]=useState(savedTransactions)
  const locked=useRef(false),currentAccount=useRef(account)
  currentAccount.current=account
  const pending=transactions.find(t=>t.status==='pending'&&t.account.toLowerCase()===account?.toLowerCase())
  const updateBusy=(value:boolean)=>{locked.current=value;setBusy(value);onBusy(value)}
  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer)},[])
  useEffect(()=>{try{localStorage.setItem(key,JSON.stringify(transactions))}catch{/* Current session remains usable. */}},[transactions])
  useEffect(()=>{setReview(null);setAllowances(null)},[account,a,b,mode])
  useEffect(()=>{
    let cancelled=false
    setLoading(true);setError('');setPool(null);setBalances(null)
    void readPool(client,a,b,account).then(p=>{if(!cancelled)setPool(p)}).catch(e=>{if(!cancelled)setError(friendlySwapError(e))}).finally(()=>{if(!cancelled)setLoading(false)})
    if(account)void Promise.all([readBalance(client,a,account),readBalance(client,b,account)]).then(v=>{if(!cancelled)setBalances(v)}).catch(()=>{if(!cancelled)setMessage('余额读取失败，请刷新。')})
    return()=>{cancelled=true}
  },[client,a,b,account,refresh])
  useEffect(()=>{let cancelled=false;setAllowances(null);if(review)void liquidityAllowance(client,review).then(v=>{if(!cancelled)setAllowances(v)}).catch(()=>{if(!cancelled)setMessage('授权读取失败，请关闭后重试。')});return()=>{cancelled=true}},[client,review])
  let amountA=0n,amountB=0n,parseError=''
  if(value&&pool&&pool.reserveA>0n&&pool.reserveB>0n)try {
    const amount=parseAmount(value,side==='a'?a.decimals:b.decimals)
    amountA=side==='a'?amount:amount*pool.reserveA/pool.reserveB
    amountB=side==='b'?amount:amount*pool.reserveB/pool.reserveA
  } catch(e){parseError=friendlySwapError(e)}
  const liquidity=(pool?.owned??0n)*BigInt(percent)/100n
  const removedA=pool?.supply?liquidity*pool.reserveA/pool.supply:0n,removedB=pool?.supply?liquidity*pool.reserveB/pool.supply:0n
  const restriction=writeRestriction(a,b)
  const insufficient=!!balances&&mode==='add'&&(amountA>balances[0]||amountB>balances[1])
  const validPool=pool&&pool.pair!==zeroAddress&&pool.reserveA>0n&&pool.reserveB>0n&&pool.supply>0n
  const ready=validPool&&!restriction&&!insufficient&&!parseError&&(mode==='add'?amountA>0n&&amountB>0n:liquidity>0n)
  const select=(token:SwapToken)=>{if(picker==='a')setA(token);else setB(token);setValue('');setPicker(null);setMessage('')}
  const part=(which:'a'|'b',n:number)=>{
    if(!balances)return
    const t=which==='a'?a:b,total=balances[which==='a'?0:1]
    const available=t.native?(total>500000000000000n?total-500000000000000n:0n):total
    setSide(which);setValue(formatUnits(available*BigInt(n)/100n,t.decimals))
  }
  const openReview=async()=>{
    if(!account||!ready||locked.current)return
    updateBusy(true);setMessage('正在刷新池子并计算本次数量…')
    const expected=account
    try{
      const fresh=await readPool(client,a,b,account)
      if(currentAccount.current!==expected)return
      setPool(fresh)
      // Preserve the amount the user entered; derive the opposite side from the fresh pool.
      const entered=mode==='add'?parseAmount(value,side==='a'?a.decimals:b.decimals):0n
      const desiredA=side==='a'?entered:entered*fresh.reserveA/fresh.reserveB
      const desiredB=side==='b'?entered:entered*fresh.reserveB/fresh.reserveA
      setReview(buildLiquidityReview(mode,a,b,account,fresh,desiredA,desiredB,(fresh.owned??0n)*BigInt(percent)/100n,slippage));setMessage('')
    }catch(e){setMessage(friendlySwapError(e))}finally{updateBusy(false)}
  }
  const transact=async()=>{
    if(!review||!wallet||locked.current||pending||!allowances)return
    const r=review,approval=allowances.some(x=>x.current<x.amount)
    updateBusy(true);setMessage('请在钱包中确认。')
    let hash:Hash|null=null
    try{
      hash=approval?await approveLiquidity(client,wallet,r):await executeLiquidity(client,wallet,r)
      const item:Pending={hash,account:r.account,label:approval?'LP 操作授权':r.mode==='add'?`添加 ${r.a.symbol}/${r.b.symbol}`:`移除 ${r.a.symbol}/${r.b.symbol}`,status:'pending'}
      setTransactions(list=>[item,...list].slice(0,20));setMessage('交易已提交，正在等待链上回执…')
      let reason:string|undefined
      const receipt=await client.waitForTransactionReceipt({hash,timeout:90_000,onReplaced:e=>{reason=e.reason}})
      const status=reason&&reason!=='repriced'?(reason==='cancelled'?'cancelled':'replaced'):receipt.status
      setTransactions(list=>list.map(t=>t.hash===hash?{...t,hash:receipt.transactionHash,status}:t))
      setReview(null);setRefresh(n=>n+1)
      setMessage(status==='success'?(approval?'授权已确认。请重新预览，核对最新数量。':'流动性交易已确认，仓位已刷新。'):'交易未完成原操作，请查看链上记录。')
      if(status==='success'&&!approval)setValue('')
    }catch(e){setMessage(hash?'交易已提交但尚未确认，请检查记录，勿重复提交。':friendlySwapError(e));if(hash)setReview(null)}finally{updateBusy(false)}
  }
  const check=async()=>{
    if(locked.current)return
    updateBusy(true)
    try{const results=await Promise.all(transactions.filter(t=>t.status==='pending').map(async t=>{try{return {hash:t.hash,receipt:await client.getTransactionReceipt({hash:t.hash})}}catch{return null}}));setTransactions(list=>list.map(t=>{const found=results.find(r=>r?.hash===t.hash);return found?{...t,status:found.receipt.status}:t}));setRefresh(n=>n+1);setMessage(results.some(Boolean)?'交易状态已更新。':'尚未查到回执，可打开 BscScan 核对替换或取消情况。')}finally{updateBusy(false)}
  }
  const percentShare=pool?.supply&&pool.owned!==null?Number(pool.owned*1000000n/pool.supply)/10000:null
  return <section className="product-liquidity" aria-label="流动性管理"><div className="product-page-heading"><p className="swap-eyebrow">LIQUIDITY / PANCAKESWAP V2</p><h1>让资产，参与流动。</h1><p>管理已有 V2 池的流动性，LP 直接回到你的钱包。</p></div><div className="liquidity-layout"><div className="swap-card liquidity-card"><div className="product-tabs" role="tablist" aria-label="流动性操作"><button role="tab" aria-selected={mode==='add'} disabled={busy} onClick={()=>setMode('add')}>添加流动性</button><button role="tab" aria-selected={mode==='remove'} disabled={busy} onClick={()=>setMode('remove')}>移除流动性</button></div><div className="liquidity-protocol"><span>协议</span><strong>PancakeSwap V2</strong><a href={`https://bscscan.com/address/${ROUTER}`} target="_blank" rel="noreferrer">官方路由 ↗</a></div><fieldset disabled={busy||!!pending}><div className="liquidity-pair">{[a,b].map((t,i)=><button key={i} className="swap-token-selector" aria-label={`选择流动性代币 ${i===0?'A':'B'}`} onClick={()=>setPicker(i===0?'a':'b')}><TokenIcon token={t}/><strong>{t.symbol}</strong><span>⌄</span></button>)}</div>{mode==='add'?<div className="liquidity-amounts">{[a,b].map((t,i)=>{const which=i===0?'a':'b',calculated=i===0?amountA:amountB;return <div className="swap-asset-box" key={which}><div className="swap-asset-label"><label htmlFor={`lp-${which}`}>{t.symbol} 数量</label><span>余额 {balances?displayAmount(balances[i],t.decimals):'—'}</span></div><div className="swap-asset-main"><TokenIcon token={t}/><input id={`lp-${which}`} aria-label={`流动性 ${which.toUpperCase()} 数量`} inputMode="decimal" placeholder="0" maxLength={100} value={side===which?value:calculated?formatUnits(calculated,t.decimals):''} onChange={e=>{setSide(which);setValue(e.target.value.trim())}}/></div><div className="swap-percentages">{[25,50,75,100].map(n=><button key={n} disabled={!balances} onClick={()=>part(which,n)}>{n===100?'MAX':`${n}%`}</button>)}</div></div>})}<p className="swap-small-note">另一侧按当前池子比例计算；BNB 快捷比例预留 0.0005 BNB 网络费。</p></div>:<div className="liquidity-remove"><div className="liquidity-percentage"><span>移除比例</span><strong>{percent}%</strong></div><input aria-label="移除流动性百分比" type="range" min="1" max="100" value={percent} onChange={e=>setPercent(Number(e.target.value))}/><div className="swap-percentages">{[25,50,75,100].map(n=><button key={n} aria-pressed={percent===n} onClick={()=>setPercent(n)}>{n===100?'MAX':`${n}%`}</button>)}</div><dl className="product-details"><div><dt>移除 LP</dt><dd>{pool?.owned==null?'—':displayAmount(liquidity,18)}</dd></div><div><dt>预计取回 {a.symbol}</dt><dd>{pool?.owned==null?'—':displayAmount(removedA,a.decimals)}</dd></div><div><dt>预计取回 {b.symbol}</dt><dd>{pool?.owned==null?'—':displayAmount(removedB,b.decimals)}</dd></div></dl></div>}<div className="liquidity-slippage"><label htmlFor="lp-slippage">滑点上限</label><select id="lp-slippage" value={slippage} onChange={e=>setSlippage(Number(e.target.value))}><option value={10}>0.1%</option><option value={50}>0.5%</option><option value={100}>1%</option></select></div></fieldset>{loading&&<p role="status">正在读取链上池子…</p>}{(error||parseError)&&<p className="swap-alert" role="alert">{error||parseError}</p>}{!loading&&pool&&!validPool&&!sameAsset(a,b)&&<p className="swap-alert">没有可用的 V2 池。本版支持已有池，暂不创建新池。</p>}{restriction&&<p className="swap-small-note">{restriction}</p>}{insufficient&&<p className="swap-alert">余额不足，请减少输入数量。</p>}<button className="swap-primary swap-submit" disabled={busy||!!pending||!!account&&(!ready||loading||!balances)} onClick={()=>account?void openReview():onConnect()}>{busy?'正在处理…':pending?'有待确认交易':!account?'连接钱包':mode==='remove'&&pool?.owned===0n?'暂无可移除 LP':ready?'预览并确认 →':'请选择资产并输入数量'}</button><p className="swap-card-foot">平台 LP 服务费 0% · 网络 Gas 由钱包显示</p></div><aside className="liquidity-position"><div className="product-panel"><div className="product-panel-title"><h2>池子与我的仓位</h2><button disabled={loading||busy} onClick={()=>setRefresh(n=>n+1)}>刷新 ↻</button></div><div className="liquidity-icons"><TokenIcon token={a}/><TokenIcon token={b}/><strong>{a.symbol} / {b.symbol}</strong></div><dl className="product-details"><div><dt>{a.symbol} 储备</dt><dd>{pool?displayAmount(pool.reserveA,a.decimals):'—'}</dd></div><div><dt>{b.symbol} 储备</dt><dd>{pool?displayAmount(pool.reserveB,b.decimals):'—'}</dd></div><div><dt>我的 LP</dt><dd>{pool?.owned==null?'连接钱包查看':displayAmount(pool.owned,18)}</dd></div><div><dt>池中份额</dt><dd>{percentShare===null?'—':`${percentShare.toFixed(4)}%`}</dd></div></dl>{pool&&pool.pair!==zeroAddress&&<a className="product-link" href={`https://bscscan.com/address/${pool.pair}`} target="_blank" rel="noreferrer">查看池合约 ↗</a>}<p className="swap-small-note">{pool?`区块 #${pool.block} · ${new Date(pool.fetchedAt).toLocaleTimeString('zh-CN')}${clock-pool.fetchedAt>60000?' · 请刷新':''}`:'正在等待链上数据'}</p></div><div className="product-panel"><h2>了解流动性</h2><p>添加两种资产后获得 LP。移除时销毁你的 LP，并按份额取回池中资产。</p><p>资产比例随交易变化，取回数量可能与投入不同。此处未估算年化收益。</p><p>每笔操作先展示最低数量，再通过官方路由模拟，最后由钱包确认。</p></div></aside></div>{message&&<p className="swap-feedback" role="status">{message}</p>}{transactions.length>0&&<div className="product-panel liquidity-transactions"><div className="product-panel-title"><h2>流动性记录</h2><button disabled={busy} onClick={()=>void check()}>检查待确认交易 ↻</button></div><p className="swap-small-note">记录保存在当前浏览器；最终状态以链上为准。</p>{transactions.map(t=><a key={t.hash} href={`https://bscscan.com/tx/${t.hash}`} target="_blank" rel="noreferrer"><span>{t.label}</span><code>{t.hash.slice(0,10)}…{t.hash.slice(-6)}</code><span>{t.status==='success'?'已确认':t.status==='pending'?'待确认':t.status==='reverted'?'未成功':t.status==='cancelled'?'已取消':'已替换'} ↗</span></a>)}</div>}{picker&&<TokenPicker client={client} onSelect={select} onClose={()=>setPicker(null)}/>} {review&&<ProductDialog title={review.mode==='add'?'确认添加流动性':'确认移除流动性'} onClose={()=>setReview(null)} busy={busy}><div className="liquidity-review-pair"><TokenIcon token={review.a}/><TokenIcon token={review.b}/><h3>{review.a.symbol} / {review.b.symbol}</h3></div><dl className="product-details"><div><dt>{review.mode==='add'?'预计投入':'预计取回'} {review.a.symbol}</dt><dd>{displayAmount(review.amountA,review.a.decimals)}</dd></div><div><dt>{review.mode==='add'?'预计投入':'预计取回'} {review.b.symbol}</dt><dd>{displayAmount(review.amountB,review.b.decimals)}</dd></div><div><dt>最低 {review.a.symbol}</dt><dd>{displayAmount(review.minA,review.a.decimals)}</dd></div><div><dt>最低 {review.b.symbol}</dt><dd>{displayAmount(review.minB,review.b.decimals)}</dd></div><div><dt>{review.mode==='add'?'预计新增 LP':'移除 LP'}</dt><dd>{displayAmount(review.liquidity,18)}</dd></div><div><dt>平台服务费</dt><dd>0%</dd></div><div><dt>收款地址</dt><dd><code>{review.account}</code></dd></div><div><dt>授权与执行</dt><dd><a href={`https://bscscan.com/address/${ROUTER}`} target="_blank" rel="noreferrer">Pancake V2 官方路由 ↗</a></dd></div></dl><p className="swap-small-note">每次仅授权所需数量。已有不足额度时先重置；每笔授权确认后重新预览。LP 数量为估算，实际以回执为准。</p>{clock>=review.expiresAt&&<p className="swap-alert">报价已过期，请关闭并重新预览。</p>}{message&&<p role="status" className="swap-feedback">{message}</p>}<button className="swap-primary swap-submit" disabled={busy||!allowances||clock>=review.expiresAt||!!pending} onClick={()=>void transact()}>{busy?'等待钱包 / 链上确认…':!allowances?'读取授权…':allowances.some(x=>x.current<x.amount)?(()=>{const next=allowances.find(x=>x.current<x.amount)!;return next.current>0n?`重置 ${next.symbol} 旧授权`:`授权本次 ${next.symbol}`})():'在钱包中确认'}</button></ProductDialog>}</section>
}
