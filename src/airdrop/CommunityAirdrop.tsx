import {useEffect,useState} from 'react'
import {erc20Abi,formatUnits,type Address} from 'viem'
import {discoverWalletProviders,type WalletProviderDetail} from '../web3/walletProviders'
import {requestSender} from './wallet'
import {rpc} from './live'
import {TOKEN,DISTRIBUTOR,validateRecipients} from './community'
import LiveSendPanel from './LiveSendPanel'
import './airdrop.css'
import './community.css'
const download=(body:string)=>{const u=URL.createObjectURL(new Blob([body],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download='butterfly-200-addresses.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
export default function CommunityAirdrop(){
 const [providers,setProviders]=useState<WalletProviderDetail[]>([]),[provider,setProvider]=useState<WalletProviderDetail>(),[wallet,setWallet]=useState('')
 const [mode,setMode]=useState('platform'),[list,setList]=useState(''),[source,setSource]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const [decimals,setDecimals]=useState<number>(),[balance,setBalance]=useState('—'),[plan,setPlan]=useState<null|{token:string;decimals:number;rows:{address:string;amount:string}[];mode:string}>(null)
 useEffect(()=>{document.title='蝴蝶空投 · 200 份心意';document.body.classList.add('airdrop-body');return()=>document.body.classList.remove('airdrop-body')},[])
 useEffect(()=>discoverWalletProviders(setProviders),[])
 useEffect(()=>{let active=true;rpc.readContract({address:TOKEN,abi:erc20Abi,functionName:'decimals'}).then(d=>{if(active)setDecimals(d)}).catch(()=>{if(active)setError('代币信息读取失败，请刷新后重试。')});return()=>{active=false}},[])
 useEffect(()=>{if(!provider)return;const changed=()=>{setWallet('');setPlan(null);setBalance('—')};provider.provider.on('accountsChanged',changed);provider.provider.on('chainChanged',changed);return()=>{provider.provider.removeListener('accountsChanged',changed);provider.provider.removeListener('chainChanged',changed)}},[provider])
 useEffect(()=>{let active=true;setBalance('—');if(wallet&&decimals!==undefined)rpc.readContract({address:TOKEN,abi:erc20Abi,functionName:'balanceOf',args:[wallet as Address]}).then(v=>{if(active)setBalance(formatUnits(v,decimals))}).catch(()=>{});return()=>{active=false}},[wallet,decimals])
 async function connect(p:WalletProviderDetail){setError('');try{setWallet(await requestSender(p.provider));setProvider(p)}catch(e){setError((e as Error).message)}}
 async function platform(){setBusy(true);setError('');setPlan(null);try{const r=await fetch('/api/airdrop-recipients');const j=await r.json();if(!r.ok)throw Error(j.error);const addresses=j.recipients.map((x:{address:string})=>x.address).filter((a:string)=>![wallet.toLowerCase(),TOKEN,DISTRIBUTOR].includes(a.toLowerCase())).slice(0,200);validateRecipients(addresses.join('\n'),wallet);setList(addresses.join('\n'));setSource(`${j.source} · 区块 ${j.fromBlock}–${j.toBlock} · ${j.generatedAt}`)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function review(){setBusy(true);setError('');setPlan(null);try{if(decimals===undefined)throw Error('请等待代币精度读取成功。');const rows=validateRecipients(list,wallet);for(let i=0;i<rows.length;i+=10){const codes=await Promise.all(rows.slice(i,i+10).map(r=>rpc.getCode({address:r.address as Address})));if(codes.some(c=>c&&c!=='0x'))throw Error('名单含合约地址，请更换后重新检查。')}setPlan({token:TOKEN,decimals,rows,mode:'community200'})}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <main className="ca-page"><header className="ca-nav"><a href="/">🦋 蝴蝶股票</a><span>功能预览 · BNB Chain</span><a href="#ca-wallet">{wallet?wallet.slice(0,6)+'…'+wallet.slice(-4):'连接钱包 ↗'}</a></header>
 <section className="ca-hero"><div><p className="ad-eyebrow">BUTTERFLY AIRDROP / COMMUNITY</p><h1>把蝴蝶，<br/><em>送到更多钱包。</em></h1><p>200 个地址，200 份心意。<br/>用你自己的钱包，完成一次链上空投。</p><a className="ad-primary" href="#ca-start">开始空投 ↓</a></div><div className="ca-art" aria-hidden="true"><span>🦋</span><b>200</b><small>份链上心意</small></div></section>
 <div className="ca-stats"><div><strong>200</strong><span>接收地址</span></div><div><strong>1 枚</strong><span>每个地址发送数量</span></div><div><strong>200 枚 + Gas</strong><span>钱包支付 · 平台服务费 0</span></div></div>
 <section className="ad-card" id="ca-start"><p className="ad-eyebrow">01 / SELECT RECIPIENTS</p><h2>这次，送给谁？</h2><div className="ca-tabs"><button aria-pressed={mode==='platform'} onClick={()=>{setMode('platform');setList('');setPlan(null)}}>平台链上名单</button><button aria-pressed={mode==='custom'} onClick={()=>{setMode('custom');setList('');setPlan(null);setSource('自行导入')}}>自己的 200 个地址</button></div>
 {mode==='platform'?<><p>筛选近期在 BNB Chain 主动发起交易的钱包，过滤重复、合约和禁止接收地址。名单来自公开链上活动，不代表这些钱包已订阅空投，也不保证触达真人。</p><button className="ad-export" disabled={busy} onClick={()=>void platform()}>{busy?'正在检查…':'获取 200 个地址'}</button><small>同一时间获取的名单可能重叠；链上防重仅针对同一发送钱包和同一批次。不会生成无人控制的随机地址。</small></>:<><p>粘贴 200 个地址，或上传只有地址列的 CSV / TXT。每个地址固定发送 1 枚。</p><input aria-label="上传地址名单" type="file" accept=".csv,.txt" onChange={async e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>100000){setError('文件不能超过 100 KB');return}setList(await f.text());setPlan(null)}}/></>}
 <textarea aria-label="接收地址" placeholder="收款名单会显示在这里，每行一个地址" readOnly={mode==='platform'} value={list} onChange={e=>{setList(e.target.value);setPlan(null)}}/>
 {source&&<p className="ca-source">名单来源：{source}</p>}<div className="ca-actions"><button className="ad-export" disabled={busy||!list||decimals===undefined} onClick={()=>void review()}>核对名单与链上地址</button><button className="ad-export ad-secondary" disabled={!list} onClick={()=>download(list)}>下载名单 CSV</button></div>{plan&&<p role="status">✓ 200 个有效地址已核对，共发送 200 枚。下一步连接钱包并锁定名单。</p>}{error&&<p className="ad-error" role="alert">{error}</p>}</section>
 <section className="ad-card" id="ca-wallet"><p className="ad-eyebrow">02 / YOUR WALLET</p><h2>由你的钱包支付</h2><p>蝴蝶股票余额：<strong>{balance}</strong></p><code>{TOKEN}</code><div className="ca-actions">{providers.map(p=><button className="ad-export" key={p.info.uuid} onClick={()=>void connect(p)}>{wallet&&provider===p?'已连接 · ':''}{p.info.name}</button>)}</div>{!providers.length&&<p>未检测到钱包。电脑端请启用钱包插件；手机端请在支持 BNB Chain 的钱包内置浏览器打开本页。</p>}<p>首次需要授权 200 枚，再签名发放；两步都消耗少量 BNB。每步会先显示手续费。实际到账以链上记录为准，转账税如适用会减少到账。</p></section>
 <LiveSendPanel simple wallet={wallet} provider={provider?.provider} plan={plan} verified={decimals!==undefined}/>
 <footer>蝴蝶股票 · 每一次转账，都有链上记录。<br/>此为功能预览；钱包确认会执行真实 BSC 主网交易。</footer></main>
}
