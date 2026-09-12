import {useEffect,useState} from 'react'
import {encodeAbiParameters,formatEther,getAddress,isAddress,parseEther,type Address,type Hex} from 'viem'
import {REVENUE,ZERO,mineSalt} from './protocol'
import {client,prepare,records,type Prepared} from './service'
import {mintFactoryData,mintCampaignData,mintFactoryAbi,verifyMintDeployment,readCampaign} from './mint'
import deployedMint from '../../public/vault/mint-deployment.json'
import acceptedMint from '../../public/vault/mint-acceptance.json'
import {acceptanceInput} from './acceptance'

type Props={account:Address|null;busy:boolean;run:(action:()=>Promise<void>)=>Promise<void>;status:(s:string)=>void;review:(p:Prepared|null)=>void;connect:()=>void}
const key='butterfly-mint-factory-tx-v1'
const explorer=(address:string)=>`https://bscscan.com/${address.length===66?'tx':'address'}/${address}`
export function MintPanel({account,busy,run,status,review,connect}:Props){
 const query=new URLSearchParams(location.search)
 const [hash,setHash]=useState(()=>query.get('factoryTx')||deployedMint.transactionHash)
 const [verified,setVerified]=useState<Awaited<ReturnType<typeof verifyMintDeployment>>|null>(null)
 const [campaignInput,setCampaignInput]=useState(query.get('campaign')||acceptedMint.campaign)
 const [campaign,setCampaign]=useState<Awaited<ReturnType<typeof readCampaign>>|null>(null)
 const [campaigns,setCampaigns]=useState<Address[]>([])
 const [name,setName]=useState(''),[symbol,setSymbol]=useState(''),[meta,setMeta]=useState(acceptanceInput.meta)
 const [target,setTarget]=useState('2'),[days,setDays]=useState('7'),[minimum,setMinimum]=useState('100000'),[shares,setShares]=useState('1')
 useEffect(()=>{
  let active=true;setCampaign(null);review(null)
  if(verified&&isAddress(campaignInput)){
   status('正在读取 Mint 项目和当前钱包份额…')
   readCampaign(client,verified.address,getAddress(campaignInput),account||ZERO).then(s=>{if(active){setCampaign(s);status('Mint 项目已读取，请核对份额后选择认购或退款')}}).catch(e=>{if(active)status('项目读取失败，请点击「读取 / 刷新项目状态」重试：'+String(e).slice(0,150))})
  }
  return()=>{active=false}
 },[account,verified?.address,campaignInput])
 useEffect(()=>{void run(verify)},[])
 const invalidate=()=>review(null)
 async function verify(){review(null);setVerified(null);setCampaign(null);if(!/^0x[0-9a-fA-F]{64}$/.test(hash))throw Error('请输入部署工厂的交易哈希');status('正在核对部署字节码、管理员与收益地址…');const v=await verifyMintDeployment(client,hash as Hex);setVerified(v);localStorage.setItem(key,hash);await list(v.address);status('Mint 工厂代码和权限已核对，可以创建与管理项目')}
 async function list(address:Address){const count=await client.readContract({address,abi:mintFactoryAbi,functionName:'campaignCount'}) as bigint;const start=count>20n?count-20n:0n;const found=await Promise.all(Array.from({length:Number(count-start)},(_,i)=>client.readContract({address,abi:mintFactoryAbi,functionName:'campaigns',args:[start+BigInt(i)]}))) as Address[];setCampaigns(found.reverse())}
 async function create(){if(!account||!verified)throw Error('请先连接钱包并核验工厂');review(null);const shares=Number(target),duration=Number(days);if(!Number.isInteger(shares)||shares<1||shares>1600||!Number.isInteger(duration)||duration<1||duration>89)throw Error('目标为 1–1600 份，募集期为 1–89 天');if(!name.trim()||new TextEncoder().encode(name.trim()).length>64||!symbol.trim()||new TextEncoder().encode(symbol.trim()).length>16)throw Error('请填写有效名称与符号');if(!/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,})$/.test(meta))throw Error('请输入 Flap / IPFS 资料 CID');const min=parseEther(minimum);if(min<=0n)throw Error('最低代币输出须大于 0');const block=await client.getBlock();const terms={name:name.trim(),symbol:symbol.trim(),meta,targetShares:shares,deadline:block.timestamp+BigInt(duration)*86400n,minimumTokensOut:min,vaultFactory:getAddress('0xfd2437DFFB8EBe9F96125b30c85Be22f99Fdddf3'),vaultData:encodeAbiParameters([{type:'uint256'},{type:'uint256'}],[60n,1000n]),buyTaxRate:300,sellTaxRate:300,taxDuration:3153600000n,antiFarmerDuration:2592000n,mktBps:10000,deflationBps:0,dividendBps:0,lpBps:0,minimumShareBalance:0n,dividendToken:ZERO};status('正在模拟创建 Mint 项目…');review(await prepare(client,account,verified.address,mintFactoryData('createCampaign',[terms]),0n,`创建 Mint：${terms.name}，目标 ${shares} 份 / ${formatEther(BigInt(shares)*10n**16n)} BNB，截止 ${new Date(Number(terms.deadline)*1000).toLocaleString()}，最低输出 ${minimum} 枚`));status('创建项目不存入募集资金，请核对下方交易。成功后刷新项目列表。')}
 async function load(address=campaignInput){review(null);setCampaign(null);if(!verified||!isAddress(address))throw Error('请核验工厂并填写项目地址');const s=await readCampaign(client,verified.address,getAddress(address),account||ZERO);setCampaignInput(address);setCampaign(s);status('已从同一区块读取 Mint 项目和你的份额')}
 async function action(method:'mint'|'refund'|'launch'|'claim'|'abort'|'claimCreatorDust'){
  review(null);if(!account||!verified||!campaign)throw Error('请连接钱包并读取 Mint 项目');const s=await readCampaign(client,verified.address,campaign.address,account);setCampaign(s);let args:unknown[]=[],value=0n,label='';
  if(method==='mint'){if(!/^\d+$/.test(shares)||BigInt(shares)<=0n)throw Error('份额必须为正整数');args=[BigInt(shares)];value=BigInt(shares)*10n**16n;label=`认购 ${shares} 份，每份 0.01 BNB。发射前可退款，发射后按份领取代币。`}
  if(method==='refund'){args=[account];label=`退回你的全部 ${s.shares} 份，收款地址 ${account}`}
  if(method==='claim'){args=[account];label=`领取你的代币与剩余 BNB 到 ${account}；代币转账税以链上执行为准`}
  if(method==='abort'){label='取消此 Mint 项目，参与者保留各自退款权'}
  if(method==='claimCreatorDust'){args=[account];label='所有参与者领取后，收取剩余舍入尾差到创建者钱包'}
  if(method==='launch'){if(s.total!==s.target||s.launched||s.aborted)throw Error('项目必须满额且尚未发射或取消');status('正在计算代币地址…');const mined=await mineSalt(n=>status(`正在计算 7777 地址，已尝试 ${n} 次`));const code=await client.getCode({address:mined.address});if(code&&code!=='0x')throw Error('代币地址已被使用，请重新检查');args=[mined.salt];label=`发射 Mint，使用项目内 ${formatEther(s.total*10n**16n)} BNB 首购；最低输出 ${formatEther(s.config.minimumTokensOut)} 枚，预测代币 ${mined.address}。本交易钱包仅支付网络费。`}
  status('正在模拟链上操作…');review(await prepare(client,account,s.address,mintCampaignData(method,args),value,label));status('模拟通过，请核对下方真实交易。成功后刷新项目状态。')
 }
 const field=(label:string,value:string,set:(s:string)=>void)=><label><span>{label}</span><input disabled={busy} value={value} onChange={e=>{invalidate();set(e.target.value)}}/></label>
 return <>
 <section className="vl-card"><h2>蝴蝶 Mint · 独立合约</h2><p>每份 0.01 BNB；发射前可自行退款，满额后调用 Flap 创建代币与百分比回购金库，参与者按份额领币。募集条款创建后固定，工厂不可升级。</p><p>管理员与平台佣金接收人：<code>{REVENUE}</code>。管理员只能暂停新项目创建，不能提取参与者的募集资金。</p><p>目前进行小额主网验收。分叉测试不等于主网验收，也不代表独立审计。回购金库仍使用第三方模板，其作者费用按模板执行。</p><a href="https://github.com/xuxi1234/flap-stock-meme/blob/preview/butterfly-vault-20260911/contracts/src/ButterflyMint.sol" target="_blank" rel="noreferrer">查看完整合约源码</a>{!account&&<p><button onClick={connect}>连接钱包</button></p>}</section>
 <section className="vl-card"><h2>1 Mint 工厂已部署</h2><p>工厂：<a href={explorer(deployedMint.factory)} target="_blank" rel="noreferrer">{deployedMint.factory}</a></p><p>实际网络费 {deployedMint.actualFeeBNB} BNB · 转入金额 0 BNB。无需再次部署。</p><a href={explorer(deployedMint.transactionHash)} target="_blank" rel="noreferrer">查看成功部署交易</a><p>{verified?'工厂实时核验已通过。':'正在核验链上代码和权限；若读取失败，可点击下方「核验工厂」重试。'}</p></section>
 <section className="vl-card"><h2>2 核验工厂部署回执</h2>{field('部署工厂的交易哈希',hash,s=>{setHash(s);setVerified(null);setCampaign(null)})}<button disabled={busy} onClick={()=>void run(verify)}>核验工厂</button>{records().filter(r=>r.label==='部署蝴蝶 Mint 工厂').map(r=><p key={r.hash}><button disabled={busy} onClick={()=>{invalidate();setHash(r.hash);setVerified(null)}}>填入本次部署哈希</button> <a href={explorer(r.hash)} target="_blank" rel="noreferrer">{r.hash}</a></p>)}{verified&&<p>已核验工厂：<a href={explorer(verified.address)} target="_blank" rel="noreferrer">{verified.address}</a></p>}<small>手机和电脑使用相同交易哈希即可核验同一个工厂，资产与份额直接读取 BSC。</small></section>
 {verified&&<>{campaignInput&&<section className="vl-card"><h2>3 Mint 项目已选中</h2><p><code>{campaignInput}</code></p>{campaignInput.toLowerCase()===acceptedMint.campaign.toLowerCase()&&<><p>验收项目已创建，无需重复创建。下一步先认购 1 份（0.01 BNB），确认后测试退款。</p><a href={explorer(acceptedMint.transactionHash)} target="_blank" rel="noreferrer">查看项目创建交易</a></>}<button disabled={busy} onClick={()=>{invalidate();setCampaignInput('');setCampaign(null)}}>创建其他 Mint 项目</button></section>}{!campaignInput&&<section className="vl-card"><h2>3 创建 Mint 项目</h2><p>默认资料为验收测试资料。每份 0.01 BNB；买卖税各 3%，税收金库份额 100%，回购间隔 60 秒、单次支出比例 10%。</p><div className="vl-fields">{field('名称',name,setName)}{field('符号',symbol,setSymbol)}{field('目标份额',target,setTarget)}{field('募集天数',days,setDays)}{field('发射最低代币输出（18 位精度）',minimum,setMinimum)}{field('Flap 资料 CID',meta,setMeta)}</div><p>最低输出是发射交易的保护阈值，并非收益承诺；设置过高可能无法发射，届时仍可退款。</p><button disabled={busy} onClick={()=>void run(create)}>检查创建 Mint 项目</button></section>}
 <section className="vl-card"><h2>4 认购、退款与领币</h2><button disabled={busy} onClick={()=>void run(async()=>{await list(verified.address);status('项目列表已更新')})}>刷新我的工厂项目</button>{campaigns.map(a=><p key={a}><button disabled={busy} onClick={()=>void run(()=>load(a))}>{a}</button></p>)}{field('Mint 项目合约地址',campaignInput,s=>{setCampaignInput(s);setCampaign(null)})}<button disabled={busy} onClick={()=>void run(()=>load())}>读取 / 刷新项目状态</button>
 {campaign&&<><h3>{campaign.config.name} · {campaign.config.symbol}</h3><dl className="vl-facts"><dt>状态</dt><dd>{campaign.launched?'已发射，可领币':campaign.aborted?'已取消，可退款':Number(campaign.deadline)*1000<=Date.now()?'已到期，可退款':'募集中，发射前可退款'}</dd><dt>份额进度</dt><dd>{String(campaign.total)} / {String(campaign.target)}</dd><dt>你的未退 / 未领份额</dt><dd>{String(campaign.shares)}</dd><dt>截止时间</dt><dd>{new Date(Number(campaign.deadline)*1000).toLocaleString()}</dd><dt>税前可领代币</dt><dd>{formatEther(campaign.claimable[0])}</dd><dt>可领剩余 BNB</dt><dd>{formatEther(campaign.claimable[1])}</dd></dl>{campaign.launched&&<p>代币：<a href={explorer(campaign.token)} target="_blank" rel="noreferrer">{campaign.token}</a></p>}
 {!campaign.launched&&<>{field('认购份额',shares,setShares)}<button disabled={busy||campaign.aborted||campaign.total>=campaign.target||Number(campaign.deadline)*1000<=Date.now()} onClick={()=>void run(()=>action('mint'))}>检查认购</button><button disabled={busy||campaign.shares===0n} onClick={()=>void run(()=>action('refund'))}>检查退回全部份额</button><button disabled={busy||campaign.aborted||campaign.total!==campaign.target||Number(campaign.deadline)*1000<=Date.now()} onClick={()=>void run(()=>action('launch'))}>检查满额发射</button>{account?.toLowerCase()===campaign.creator.toLowerCase()&&<button disabled={busy||campaign.aborted} onClick={()=>void run(()=>action('abort'))}>取消项目</button>}</>}
 {campaign.launched&&<><button disabled={busy||campaign.shares===0n} onClick={()=>void run(()=>action('claim'))}>检查领取代币</button>{account?.toLowerCase()===campaign.creator.toLowerCase()&&<button disabled={busy} onClick={()=>void run(()=>action('claimCreatorDust'))}>检查领取尾差</button>}</>}<p><a href={`/?view=vault-live&panel=mint&factoryTx=${verified.hash}&campaign=${campaign.address}`}>此项目跨端链接</a></p></>}
 </section></>}
 </>
}
