import { createPublicClient, createWalletClient, custom, encodeAbiParameters, encodeFunctionData, erc20Abi, fallback, formatEther, getContractAddress, http, isAddress, keccak256, parseAbi, parseAbiParameters, parseEventLogs, zeroAddress, type Address, type EIP1193Provider, type Hex } from 'viem'
import { bsc } from 'viem/chains'
import artifact from './distributor.json'
import legacyArtifact from './distributor-v1.json'
import { randomRecipients, units } from './math'

export const abi = parseAbi([
 'function completed(address,bytes32) view returns (bool)',
 'function distribute(address token,bytes32 batchId,address[] recipients,uint256[] amounts)',
 'event Delivered(address indexed sender,bytes32 indexed batchId,address indexed token,address recipient,uint256 requested,uint256 received)',
 'event BatchCompleted(address indexed sender,bytes32 indexed batchId,address indexed token,uint256 count,uint256 total)',
])
export const rpc = createPublicClient({chain:bsc,transport:fallback([http('/api/swap-rpc',{timeout:16000,retryCount:0}),http('https://bsc-dataseed.bnbchain.org',{timeout:10000,retryCount:0})])})
export type Recipient = {address:Address; amount:string}
export type Intent = {kind:'deploy'|'reset'|'approve'|'send'|'revoke';to?:Address;data:Hex;nonce:number;gas:string;gasPrice:string;hash?:Hex;batch?:number;createdAt:string}
export type RecordRow = {kind:Intent['kind'];layout?:'legacy';hash:Hex;status:'success'|'reverted';gasWei:string;batch?:number;received?:{address:Address;requested:string;received:string}[]}
export type Task = {version:1;toolVersion?:2;legacySentRows?:number;retiredDistributor?:Address;chainId:56;id:Hex;wallet:Address;token:Address;decimals:number;rows:Recipient[];mode:string;budget:string;distributor?:Address;intent?:Intent;records:RecordRow[]}
const key = (wallet:string) => 'butterfly-airdrop-live-v1:56:'+wallet.toLowerCase()
export const BATCH_SIZE=200
export const batchSize=(t:Task)=>t.toolVersion===2?BATCH_SIZE:25
export const batchCount=(t:Task)=>Math.ceil((t.rows.length-(t.legacySentRows??0))/batchSize(t))
export const confirmedRecipients=(t:Task)=>(t.legacySentRows??0)+Math.min(t.rows.length-(t.legacySentRows??0),completedCount(t)*batchSize(t))
const taskArtifact=(t:Task)=>t.toolVersion===2?artifact:legacyArtifact
const cacheKey=(t:Task)=>`butterfly-distributor${t.toolVersion===2?'-v2':''}:56:${t.wallet.toLowerCase()}`
export function cancelUnsent(wallet:string){const t=loadTask(wallet);if(t?.intent||t?.records.length)throw Error('已有交易记录，不能清除任务。');localStorage.removeItem(key(wallet))}
export function canonicalRows(rows:{address:string;amount:string}[],decimals:number):Recipient[] {
 const map=new Map<string,bigint>()
 if(!rows.length || rows.length>2000)throw Error('名单需要 1–2000 条有效记录。')
 for(const r of rows){if(!isAddress(r.address)||r.address.toLowerCase()===zeroAddress)throw Error('清单含未提供或无效地址。');const a=r.address.toLowerCase();map.set(a,(map.get(a)??0n)+units(r.amount,decimals))}
 return [...map].sort(([a],[b])=>a.localeCompare(b)).map(([address,amount])=>({address:address as Address,amount:amount.toString()}))
}
export function taskId(wallet:Address,token:Address,rows:Recipient[]):Hex {
 return keccak256(encodeAbiParameters(parseAbiParameters('uint256,address,address,address[],uint256[]'),[56n,wallet,token,rows.map(r=>r.address),rows.map(r=>BigInt(r.amount))]))
}
export function validateTask(t:Task):Task {
 if(t.version!==1||t.chainId!==56||!isAddress(t.wallet)||!isAddress(t.token)||!Array.isArray(t.rows)||t.rows.length<1||t.rows.length>2000||!Array.isArray(t.records)||!Number.isInteger(t.decimals)||t.decimals<0||t.decimals>36)throw Error('任务文件无效。')
 if(t.rows.some(r=>!isAddress(r.address)||r.address.toLowerCase()===zeroAddress||!/^\d+$/.test(r.amount)||BigInt(r.amount)<=0n))throw Error('任务名单无效。')
 if(new Set(t.rows.map(r=>r.address.toLowerCase())).size!==t.rows.length)throw Error('任务含重复地址。')
 if(taskId(t.wallet,t.token,t.rows)!==t.id)throw Error('任务摘要与名单不一致。')
 if(!/^\d+$/.test(t.budget)||BigInt(t.budget)<=0n)throw Error('任务 Gas 预算无效。')
 if(t.toolVersion!==undefined&&t.toolVersion!==2)throw Error('任务工具版本无效。')
 if(t.retiredDistributor&&(!isAddress(t.retiredDistributor)||t.toolVersion!==2))throw Error('旧工具记录无效。')
 if(t.records.some(r=>r.layout!==undefined&&r.layout!=='legacy'))throw Error('交易记录版本无效。')
 const legacy=t.records.filter(r=>r.layout==='legacy'&&r.kind==='send'&&r.status==='success')
 if(t.legacySentRows!==undefined||legacy.length){
  if(t.toolVersion!==2||!t.retiredDistributor||!Number.isInteger(t.legacySentRows)||(t.legacySentRows??0)<=0||(t.legacySentRows??0)>=t.rows.length)throw Error('旧版已发数量无效。')
  const indices=legacy.map(r=>r.batch).sort((a,b)=>a!-b!)
  if(indices.some((n,i)=>n!==i)||t.legacySentRows!==Math.min(t.rows.length,indices.length*25))throw Error('旧版发放记录与跳过数量不一致。')
 }
 if(t.distributor&&!isAddress(t.distributor))throw Error('工具合约无效。')
 return t
}
export function loadTask(wallet:string):Task|null {const data=localStorage.getItem(key(wallet));return data?validateTask(JSON.parse(data)):null}
export function saveTask(t:Task){validateTask(t);const data=JSON.stringify(t);localStorage.setItem(key(t.wallet),data);if(localStorage.getItem(key(t.wallet))!==data)throw Error('无法保存交易记录，已停止。请允许本站本地存储。')}
export function newTask(wallet:Address,token:Address,decimals:number,rows:{address:string;amount:string}[],mode:string,budget:string):Task {
 const normalized=canonicalRows(rows,decimals)
 if(normalized.some(r=>r.address.toLowerCase()===wallet.toLowerCase()))throw Error('接收名单包含发送钱包自身，请先核对并移除该地址。')
 const task:Task={version:1,toolVersion:2,chainId:56,id:taskId(wallet,token,normalized),wallet,token,decimals,rows:normalized,mode,budget:units(budget,18).toString(),records:[]}
 const previous=loadTask(wallet)
 if(previous?.intent)throw Error('上一任务仍有待确认交易，请先恢复处理。')
 if(previous?.id===task.id)return previous
 if(previous&&completedCount(previous)<batchCount(previous))throw Error('已有未完成任务，请完成后再新建。')
 if(previous?.distributor&&previous.toolVersion===2)task.distributor=previous.distributor
 saveTask(task);return task
}
export const spent=(t:Task)=>t.records.reduce((a,r)=>a+BigInt(r.gasWei),0n)
export const completedCount=(t:Task)=>new Set(t.records.filter(r=>r.kind==='send'&&r.status==='success'&&r.layout!=='legacy').map(r=>r.batch)).size
export function batch(t:Task,index:number){
 const offset=t.legacySentRows??0
 const rows=t.rows.slice(offset+index*batchSize(t),offset+(index+1)*batchSize(t))
 const id=t.toolVersion!==2?keccak256(encodeAbiParameters(parseAbiParameters('bytes32,uint256'),[t.id,BigInt(index)])):
  offset>0?keccak256(encodeAbiParameters(parseAbiParameters('bytes32,uint256,uint256,uint256'),[t.id,2n,BigInt(offset),BigInt(index)])):
  keccak256(encodeAbiParameters(parseAbiParameters('bytes32,uint256,uint256'),[t.id,2n,BigInt(index)]))
 return {rows,id}
}
export async function assertWallet(t:Task,provider:EIP1193Provider){const accounts=await provider.request({method:'eth_accounts'});const chain=await provider.request({method:'eth_chainId'});if(Number(chain)!==56||accounts[0]?.toLowerCase()!==t.wallet.toLowerCase())throw Error('请连接该任务的原发送钱包，并切换 BSC 主网。')}
export async function verifyDistributor(address:Address,t:Task){const code=await rpc.getCode({address});if(code?.toLowerCase()!==taskArtifact(t).runtime.toLowerCase())throw Error('工具合约代码不匹配，已停止授权和发送。')}
function sendData(t:Task,index:number){const b=batch(t,index);return encodeFunctionData({abi,functionName:'distribute',args:[t.token,b.id,b.rows.map(r=>r.address),b.rows.map(r=>BigInt(r.amount))]})}
async function reconcile(t:Task,hash?:Hex):Promise<Task>{
 if(!t.intent)return t
 const i=t.intent
 if(hash){if(!/^0x[0-9a-fA-F]{64}$/.test(hash))throw Error('交易哈希无效。');i.hash=hash;saveTask(t)}
 if(!i.hash)throw Error('上次钱包请求未返回哈希。请在钱包活动记录找到该笔交易，并填入下方恢复框；不要重复发送。')
 const tx=await rpc.getTransaction({hash:i.hash})
 const actualTo=tx.to?.toLowerCase()??''
 if(tx.from.toLowerCase()!==t.wallet.toLowerCase()||actualTo!==(i.to?.toLowerCase()??'')||tx.input!==i.data||tx.value!==0n||tx.nonce!==i.nonce)throw Error('交易与当前任务不匹配，请提供正确哈希。')
 const receipt=await rpc.waitForTransactionReceipt({hash:i.hash,confirmations:3,timeout:120000})
 if(t.records.some(r=>r.hash===i.hash)){delete t.intent;saveTask(t);return t}
 const record:RecordRow={hash:i.hash,kind:i.kind,status:receipt.status,gasWei:(receipt.gasUsed*receipt.effectiveGasPrice).toString(),batch:i.batch}
 if(receipt.status==='success'){
  if(i.kind==='deploy'){
   if(!receipt.contractAddress)throw Error('未找到部署地址。')
   await verifyDistributor(receipt.contractAddress,t);t.distributor=receipt.contractAddress
  }
  if(i.kind==='send'){
   if(!t.distributor||i.batch===undefined)throw Error('缺少批次资料。')
   const b=batch(t,i.batch)
   const logs=receipt.logs.filter(l=>l.address.toLowerCase()===t.distributor!.toLowerCase())
   const done=parseEventLogs({abi,logs,eventName:'BatchCompleted'}).find(l=>l.args.batchId===b.id&&l.args.sender.toLowerCase()===t.wallet.toLowerCase()&&l.args.token.toLowerCase()===t.token.toLowerCase())
   if(!done||done.args.count!==BigInt(b.rows.length)||done.args.total!==b.rows.reduce((n,r)=>n+BigInt(r.amount),0n))throw Error('发放事件与清单不符，停止自动继续。')
   const deliveries=parseEventLogs({abi,logs,eventName:'Delivered'}).filter(l=>l.args.batchId===b.id&&l.args.sender.toLowerCase()===t.wallet.toLowerCase()&&l.args.token.toLowerCase()===t.token.toLowerCase())
   if(deliveries.length!==b.rows.length||deliveries.some((l,k)=>l.args.recipient.toLowerCase()!==b.rows[k].address.toLowerCase()||l.args.requested!==BigInt(b.rows[k].amount)))throw Error('逐地址到账事件不符。')
   record.received=deliveries.map(l=>({address:l.args.recipient,requested:l.args.requested.toString(),received:l.args.received.toString()}))
  }
 }
 t.records.push(record);delete t.intent;saveTask(t)
 if(receipt.status!=='success')throw Error('该笔交易链上失败，本批没有发放；已记录消耗的 Gas。请检查原因后重新检查。')
 return t
}
export type Ready = {kind:Intent['kind']|'complete'|'pending';description:string;gas?:bigint;gasPrice?:bigint;fee?:bigint;data?:Hex;to?:Address;batch?:number;remaining?:bigint}
async function verifyHistory(t:Task){
 validateTask(t)
 // Recheck imported/stored receipt facts before trusting progress or its cumulative gas accounting.
 for(const record of t.records){
  const receipt=await rpc.getTransactionReceipt({hash:record.hash})
  if(receipt.from.toLowerCase()!==t.wallet.toLowerCase()||receipt.status!==record.status||(receipt.gasUsed*receipt.effectiveGasPrice).toString()!==record.gasWei)throw Error('历史交易记录与链上不一致，请恢复正确备份。')
  if(record.kind==='send'&&record.status==='success'){
   const distributor=record.layout==='legacy'?t.retiredDistributor:t.distributor
   if(record.batch===undefined||!distributor)throw Error('缺少历史批次资料。')
   const b=batch(record.layout==='legacy'?{...t,toolVersion:undefined,legacySentRows:undefined}:t,record.batch)
   const log=parseEventLogs({abi,logs:receipt.logs.filter(l=>l.address.toLowerCase()===distributor.toLowerCase()),eventName:'BatchCompleted'}).find(l=>l.args.sender.toLowerCase()===t.wallet.toLowerCase()&&l.args.token.toLowerCase()===t.token.toLowerCase()&&l.args.batchId===b.id)
   if(!log||log.args.count!==BigInt(b.rows.length)||log.args.total!==b.rows.reduce((n,r)=>n+BigInt(r.amount),0n))throw Error('历史批次与当前名单不匹配。')
  }
 }
}
export async function prepare(t:Task):Promise<Ready>{
 await verifyHistory(t)
 if(t.intent)return {kind:'pending',description:'恢复待确认交易'}
 if(spent(t)>BigInt(t.budget))throw Error('累计 Gas 已超过本任务预算。')
 const outstanding=t.rows.slice(confirmedRecipients(t)).reduce((n,r)=>n+BigInt(r.amount),0n)
 const [precision,tokenBalance]=await Promise.all([rpc.readContract({address:t.token,abi:erc20Abi,functionName:'decimals'}),rpc.readContract({address:t.token,abi:erc20Abi,functionName:'balanceOf',args:[t.wallet]})])
 if(precision!==t.decimals)throw Error('代币精度不匹配，停止执行。')
 if(tokenBalance<outstanding)throw Error('钱包代币余额不足以完成剩余发放；未部署工具或请求授权。')
 if(t.retiredDistributor){
  await verifyDistributor(t.retiredDistributor,{...t,toolVersion:undefined})
  await verifyLegacyCompletion(t.retiredDistributor,{...t,toolVersion:undefined,legacySentRows:undefined},Math.ceil((t.legacySentRows??0)/25))
  const oldAllowance=await rpc.readContract({address:t.token,abi:erc20Abi,functionName:'allowance',args:[t.wallet,t.retiredDistributor]})
  if(oldAllowance>0n)return estimate(t,{kind:'revoke',description:'升级前：撤销旧工具授权',to:t.token,data:encodeFunctionData({abi:erc20Abi,functionName:'approve',args:[t.retiredDistributor,0n]})})
 }
 if(!t.distributor){
  const cached=localStorage.getItem(cacheKey(t))
  if(cached&&isAddress(cached)){await verifyDistributor(cached,t);t.distributor=cached;saveTask(t)}
 }
 let ready:Ready
 if(!t.distributor){ready={kind:'deploy',data:taskArtifact(t).bytecode as Hex,description:t.toolVersion===2?'启用单笔 200 地址工具（仅首次部署）':'首次启用：部署旧版批量工具'}}
 else {
  await verifyDistributor(t.distributor,t)
  if(await rpc.readContract({address:t.token,abi:erc20Abi,functionName:'decimals'})!==t.decimals)throw Error('代币精度发生变化，停止执行。')
  let index=0
  while(t.records.some(r=>r.kind==='send'&&r.status==='success'&&r.layout!=='legacy'&&r.batch===index))index++
  const remaining=t.rows.slice((t.legacySentRows??0)+index*batchSize(t)).reduce((n,r)=>n+BigInt(r.amount),0n)
  const allowance=await rpc.readContract({address:t.token,abi:erc20Abi,functionName:'allowance',args:[t.wallet,t.distributor]})
  if(!remaining)return allowance>0n?await estimate(t,{kind:'revoke',description:'发放完成：撤销剩余授权',to:t.token,data:encodeFunctionData({abi:erc20Abi,functionName:'approve',args:[t.distributor,0n]})}):{kind:'complete',description:'全部批次已确认到账'}
  if(t.rows.some(r=>r.address.toLowerCase()===t.distributor!.toLowerCase()))throw Error('收款名单不能包含工具合约。')
  if(await rpc.readContract({address:t.token,abi:erc20Abi,functionName:'balanceOf',args:[t.wallet]})<remaining)throw Error('钱包代币余额不足以完成剩余发放。')
  if(allowance!==remaining){
   ready={kind:allowance>0n?'reset':'approve',description:allowance>0n?'先清零已有授权，再设置本次所需数量':'授权本次剩余发放数量',to:t.token,data:encodeFunctionData({abi:erc20Abi,functionName:'approve',args:[t.distributor,allowance>0n?0n:remaining]}),remaining}
  } else {
   if(await rpc.readContract({address:t.distributor,abi,functionName:'completed',args:[t.wallet,batch(t,index).id]}))throw Error('本批链上已完成，但本地缺少记录。请恢复原任务备份，禁止重复创建工具绕过。')
   ready={kind:'send',description:`一笔交易发送第 ${index+1} / ${batchCount(t)} 批（${batch(t,index).rows.length} 个地址）`,to:t.distributor,data:sendData(t,index),batch:index,remaining}
  }
 }
 return estimate(t,ready)
}
async function estimate(t:Task,ready:Ready):Promise<Ready>{
 const gas=(await rpc.estimateGas({account:t.wallet,to:ready.to,data:ready.data,value:0n}))*130n/100n+10000n
 if(gas>16000000n)throw Error('本笔交易模拟所需 Gas 超过工具单笔上限，已停止。不会自动拆成多笔发送。')
 const gasPrice=(await rpc.getGasPrice())*120n/100n
 const fee=gas*gasPrice
 if(spent(t)+fee>BigInt(t.budget))throw Error('本次交易的最高手续费将超出任务 Gas 预算，已停止。')
 if(await rpc.getBalance({address:t.wallet})<fee)throw Error(`BNB 不足。本次最多需要 ${formatEther(fee)} BNB 网络费。`)
 return {...ready,gas,gasPrice,fee}
}
export async function runStep(wallet:Address,provider:EIP1193Provider,expectedId:Hex,expected?:Ready,restoreHash?:Hex):Promise<Task>{
 if(!navigator.locks)throw Error('请使用支持安全任务锁的新版浏览器或钱包浏览器。')
 return navigator.locks.request(key(wallet),{ifAvailable:true},async lock=>{
  if(!lock)throw Error('另一个标签页正在处理此钱包的任务。')
  const t=loadTask(wallet)
  if(!t||t.id!==expectedId)throw Error('当前任务已变化，请重新核对。')
  await assertWallet(t,provider)
  if(t.intent)return reconcile(t,restoreHash)
  const ready=await prepare(t)
  if(ready.kind==='complete')return t
  if(!expected||ready.kind!==expected.kind||ready.data!==expected.data||ready.to!==expected.to||!expected.fee||!ready.fee||ready.fee>expected.fee)throw Error('交易内容或费用发生变化，请重新检查后确认。')
  await assertWallet(t,provider)
  const [latest,pending]=await Promise.all([rpc.getTransactionCount({address:wallet,blockTag:'latest'}),rpc.getTransactionCount({address:wallet,blockTag:'pending'})])
  if(latest!==pending)throw Error('钱包还有待确认交易，请等待确认后再发放。')
  t.intent={kind:ready.kind as Intent['kind'],to:ready.to,data:ready.data!,nonce:pending,gas:ready.gas!.toString(),gasPrice:ready.gasPrice!.toString(),batch:ready.batch,createdAt:new Date().toISOString()}
  saveTask(t)
  try {
   const w=createWalletClient({account:wallet,chain:bsc,transport:custom(provider)})
   t.intent.hash=await w.sendTransaction({to:ready.to,data:ready.data,value:0n,gas:ready.gas!,gasPrice:ready.gasPrice!,nonce:pending})
   saveTask(t)
  } catch(e) {
   // Only an explicit user rejection may discard an intent. Ambiguous responses are never retried automatically.
   let current:unknown=e;let rejected=false
   for(let n=0;n<8&&current&&typeof current==='object';n++){if('code' in current&&current.code===4001)rejected=true;current='cause' in current?current.cause:null}
   if(rejected){delete t.intent;saveTask(t);throw Error('你已取消钱包签名，未继续发送。')}
   throw Error('钱包请求未完成确认。任务已锁定，请查看钱包活动记录并恢复交易哈希。')
  }
  const result=await reconcile(t)
  if(result.distributor)localStorage.setItem(cacheKey(result),result.distributor)
  return result
 })
}
export function predictedDeployment(t:Task){return t.intent?.kind==='deploy'?getContractAddress({from:t.wallet,nonce:BigInt(t.intent.nonce)}):undefined}

async function verifyLegacyCompletion(distributor:Address,t:Task,expected:number){
 for(let index=0;index<Math.ceil(t.rows.length/25);index++){
  const done=await rpc.readContract({address:distributor,abi,functionName:'completed',args:[t.wallet,batch({...t,toolVersion:undefined,legacySentRows:undefined},index).id]})
  if(done!==(index<expected))throw Error('旧工具链上发放与本机记录不一致，已停止重复发送。请先恢复遗漏的交易记录。')
 }
}
export async function upgradeToSingleTransaction(wallet:Address,provider:EIP1193Provider,restoreHash?:Hex):Promise<Task>{
 if(!navigator.locks)throw Error('浏览器不支持任务锁。')
 return navigator.locks.request(key(wallet),{ifAvailable:true},async lock=>{
  if(!lock)throw Error('另一个标签页正在处理此任务。')
  let t=loadTask(wallet)
  if(!t)throw Error('请先恢复原任务。')
  await assertWallet(t,provider)
  if(t.toolVersion===2)return t
  // Resolve an already broadcast transaction first; this does not request another signature.
  if(t.intent)t=await reconcile(t,restoreHash)
  await verifyHistory(t)
  const succeeded=t.records.filter(r=>r.kind==='send'&&r.status==='success')
  const indices=succeeded.map(r=>r.batch).sort((a,b)=>a!-b!)
  if(indices.some((n,i)=>n!==i))throw Error('旧任务批次记录不连续，请先恢复缺失交易。')
  const sent=Math.min(t.rows.length,indices.length*25)
  if(sent===t.rows.length)throw Error('原名单已全部发放完成，无需再次发送。')
  if(!t.distributor){
   const cached=localStorage.getItem(cacheKey(t))
   if(cached&&isAddress(cached)){await verifyDistributor(cached,t);t.distributor=cached;saveTask(t)}
  }
  if(t.distributor){
   await verifyDistributor(t.distributor,t)
   await verifyLegacyCompletion(t.distributor,t,indices.length)
  }else if(succeeded.length)throw Error('缺少已发放工具地址。')
  await assertWallet(t,provider)
  const current=loadTask(wallet)
  if(JSON.stringify(current)!==JSON.stringify(t))throw Error('任务已变化，请重新检查。')
  localStorage.setItem(key(wallet)+':before-single',JSON.stringify(t))
  const upgraded:Task={...t,toolVersion:2,legacySentRows:sent||undefined,retiredDistributor:t.distributor,distributor:undefined,
   records:t.records.map(r=>r.kind==='send'?{...r,layout:'legacy' as const}:r)}
  saveTask(upgraded)
  return upgraded
 })
}

const archiveKey=(wallet:string)=>'butterfly-airdrop-archives:56:'+wallet.toLowerCase()
export function archivedTasks(wallet:string):Task[]{
 const raw=localStorage.getItem(archiveKey(wallet))
 if(!raw)return []
 const tasks:Task[]=JSON.parse(raw)
 if(!Array.isArray(tasks))throw Error('历史任务记录无效。')
 return tasks.map(t=>{
  validateTask(t)
  if(t.wallet.toLowerCase()!==wallet.toLowerCase())throw Error('历史任务钱包不匹配。')
  return t
 })
}
export async function freshRandomTask(wallet:Address,provider:EIP1193Provider,token:Address,decimals:number,budget:string):Promise<Task>{
 if(!navigator.locks)throw Error('浏览器不支持任务锁。')
 return navigator.locks.request(key(wallet),{ifAvailable:true},async lock=>{
  if(!lock)throw Error('另一个标签页正在处理此钱包，请等待它完成。')
  const previous=loadTask(wallet)
  const history=archivedTasks(wallet)
  const excluded=new Set([wallet,...(previous?.rows.map(r=>r.address)??[]),...history.flatMap(t=>t.rows.map(r=>r.address)),previous?.distributor??''].map(a=>a.toLowerCase()))
  const recipients=new Set<string>()
  for(let attempt=0;recipients.size<200&&attempt<10;attempt++){
   for(const address of randomRecipients(200))if(!excluded.has(address)&&recipients.size<200)recipients.add(address)
  }
  if(recipients.size!==200)throw Error('无法生成全新地址，请重试。')
  const rows=canonicalRows([...recipients].map(address=>({address,amount:'7'})),decimals)
  const task:Task={version:1,toolVersion:2,chainId:56,id:taskId(wallet,token,rows),wallet,token,decimals,rows,mode:'random',budget:units(budget,18).toString(),records:[]}
  validateTask(task)
  await assertWallet(task,provider)
  if(JSON.stringify(loadTask(wallet))!==JSON.stringify(previous))throw Error('当前任务已变化，请重新点击新建。')
  // Keep pending hashes and all receipts in a downloadable archive. A fresh task never resends the old list.
  // runStep checks the wallet nonce before any new transaction, so an existing pending transaction still blocks sending.
  if(previous){
   const remaining=history.filter(t=>t.id!==previous.id)
   const data=JSON.stringify([...remaining,previous])
   localStorage.setItem(archiveKey(wallet),data)
   if(localStorage.getItem(archiveKey(wallet))!==data)throw Error('旧任务存档失败，未新建任务。')
  }
  if(previous?.toolVersion===2&&previous.distributor)task.distributor=previous.distributor
  saveTask(task)
  return task
 })
}
