import {useEffect,useState} from 'react'
import {zeroAddress,type Address,type PublicClient} from 'viem'
import {TREASURY,feeAbi,feeDeployment,referralLink,resolveReferrer,verifyFeeDeployment} from './fees'
import {displayAmount} from './service'
import type {SwapToken} from './config'
export function ReferralPanel({account,client,token,candidate,onConnect}:{account:Address|null;client:PublicClient;token:SwapToken;candidate:Address|null;onConnect:()=>void}){
 const [stats,setStats]=useState<{count:bigint;earned:bigint;bound:Address|null}|null>(null)
 const [message,setMessage]=useState('')
 const link=account?referralLink(window.location.origin,account):''
 useEffect(()=>{
  let cancelled=false;setStats(null);setMessage('')
  if(account&&feeDeployment())void(async()=>{
   const address=await verifyFeeDeployment(client)
   const [count,earned,bound]=await Promise.all([client.readContract({address,abi:feeAbi,functionName:'invitedCount',args:[account]}),client.readContract({address,abi:feeAbi,functionName:'earned',args:[account,token.native?zeroAddress:token.address]}),resolveReferrer(client,account,candidate)])
   if(!cancelled)setStats({count,earned,bound})
  })().catch(()=>{if(!cancelled)setMessage('暂时无法读取链上邀请记录。')})
  return()=>{cancelled=true}
 },[account,client,token.address,token.native,candidate])
 return <div className="swap-referral-panel"><p className="swap-dialog-description">分享你的链接，获得好友交易服务费的 <strong>70%</strong>。返佣随成功交易以接收资产直接到账。</p>
  <div className="swap-referral-stats"><div><span>邀请返佣比例</span><strong>70<small>%</small></strong></div><div><span>已绑定邀请</span><strong>{stats?.count.toString()??'—'}</strong></div></div>
  <div className="swap-referral-earnings"><span>累计已到账 · {token.symbol}</span><strong>{stats?displayAmount(stats.earned,token.decimals):'—'}</strong><small>按资产分别统计，不将不同代币数量相加。</small></div>
  {account?<label className="swap-share-field">你的专属邀请链接<input aria-label="专属邀请链接" value={link} readOnly onFocus={e=>e.target.select()}/><button className="swap-primary" onClick={async()=>{try{await navigator.clipboard.writeText(link);setMessage('邀请链接已复制。')}catch{setMessage('请选中链接手动复制。')}}}>复制邀请链接 ↗</button></label>:<button className="swap-primary" onClick={onConnect}>连接钱包，生成邀请链接</button>}
  {candidate&&<p className="swap-small-note">链接中的邀请人：{candidate}。首次成功兑换前会再次显示并确认。</p>}
  {stats?.bound&&<p className="swap-small-note">本次采用的邀请人：{stats.bound}</p>}
  <ol className="swap-referral-steps"><li><b>01</b> 分享链接</li><li><b>02</b> 好友兑换</li><li><b>03</b> 返佣到账</li></ol>
  <details open className="swap-fee-rules"><summary>服务费与分配规则</summary><p>每次兑换收取实际接收资产的 0.8%。有邀请人：手续费的 70% 给邀请人，30% 给平台；没有邀请人：全部手续费给平台。</p><p>首次成功的邀请交易绑定邀请人，之后不能更换。不可邀请自己。网络 Gas、池费与代币税另计。</p><a href={`https://bscscan.com/address/${TREASURY}`} target="_blank" rel="noreferrer">平台营收地址：{TREASURY} ↗</a></details>
  {!feeDeployment()&&<p className="swap-feedback">邀请功能预览：收费交易尚未开放，当前不会产生返佣。</p>}{message&&<p role="status" className="swap-feedback">{message}</p>}
 </div>
}
