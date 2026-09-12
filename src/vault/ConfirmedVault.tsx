import { useEffect, useState } from 'react'
import { formatEther } from 'viem'
import { confirmedVault as known, readConfirmedVault } from './confirmed-vault'
import { client, message } from './service'

export function ConfirmedVault(){
  const [state,setState]=useState<Awaited<ReturnType<typeof readConfirmedVault>>|null>(null)
  const [error,setError]=useState(''),[loading,setLoading]=useState(true),[version,setVersion]=useState(0)
  useEffect(()=>{let active=true;setLoading(true);setError('');setState(null);readConfirmedVault(client).then(s=>{if(active)setState(s)}).catch(e=>{if(active)setError(message(e))}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[version])
  return <section className="vl-card"><h2>FLAPCHK 金库已创建</h2><p>这笔主网创建已成功，不需要再次创建验收代币。</p>
    <p><a href={'https://bscscan.com/tx/'+known.hash} target="_blank" rel="noreferrer">查看成功交易</a> · 实际网络费 {known.fee} BNB · 首购 0 BNB</p>
    <dl className="vl-facts"><dt>验收代币</dt><dd><a href={'https://bscscan.com/address/'+known.token} target="_blank" rel="noreferrer">{known.token}</a></dd><dt>金库</dt><dd>{known.vault}</dd></dl>
    <button disabled={loading} onClick={()=>setVersion(v=>v+1)}>{loading?'正在读取链上数据…':'刷新链上数据'}</button>
    {error&&<p className="vl-error" role="alert">{error}</p>}
    {state&&<><p className={state.recipientMatches?'vl-status':'vl-error'}>{state.recipientMatches?'收益接收地址核对一致':'收益接收地址与项目配置不一致'}</p><dl className="vl-facts"><dt>链上平台佣金接收人</dt><dd>{state.recipient}</dd><dt>金库当前 BNB 余额</dt><dd>{formatEther(state.balance)} BNB</dd><dt>金库累计净入账</dt><dd>{formatEther(state.totalReceived)} BNB</dd><dt>核对区块</dt><dd>{state.block.toString()}</dd></dl><p className="vl-note">金库余额与累计入账属于机制资金，不等于平台已到账收益。平台收益发放尚未完成验收。</p></>}
    <p><a className="vl-action" href={'/?view=vault-live&panel=manage&address='+known.vault}>打开此金库的管理接口</a></p>
    <p>已完成：创建、回执核对、实时读取和佣金接收地址核对。待完成：收益发放验收、独立 Mint。参考工厂的管理权限按原合约执行。</p>
  </section>
}
