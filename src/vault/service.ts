import { createPublicClient, decodeEventLog, formatEther, http, type Address, type Hex, type PublicClient, type WalletClient } from 'viem'
import { bsc } from 'viem/chains'
import { BUDGET, factoryAbi, launchAbi, VAULT_PORTAL, type Schema } from './protocol'

export const client = createPublicClient({ chain: bsc, transport: http('/api/swap-rpc', { timeout: 20000, retryCount: 1 }), batch: { multicall: false } })
export async function readFactory(address: Address) {
  const [code,schema] = await Promise.all([client.getCode({address}),client.readContract({address,abi:factoryAbi,functionName:'vaultDataSchema'})])
  if (!code || code==='0x') throw Error('此地址没有合约代码')
  // Policies and owner are optional in legacy factories. Never manufacture an owner.
  const [policies,owner] = await Promise.allSettled([
    client.readContract({address,abi:factoryAbi,functionName:'tokenCreationPolicies'}),
    client.readContract({address,abi:factoryAbi,functionName:'owner'}),
  ])
  return {schema: schema as Schema, code, policies:policies.status==='fulfilled'?policies.value:[],owner:owner.status==='fulfilled'?owner.value:null}
}
export type Prepared = {account:Address;to:Address;data:Hex;value:bigint;gas:bigint;gasPrice:bigint;maximumCost:bigint;createdAt:number;label:string}
export async function prepare(c:PublicClient, account:Address,to:Address,data:Hex,value:bigint,label:string):Promise<Prepared> {
  if (await c.getChainId()!==56) throw Error('读取服务不在 BSC 主网')
  if (value<0n || value>BUDGET) throw Error('金额超出 0.1 BNB 预算')
  const code=await c.getCode({address:to});if(!code||code==='0x')throw Error('目标地址不是已部署合约')
  await c.call({account,to,data,value})
  const [estimate,price,balance]=await Promise.all([c.estimateGas({account,to,data,value}),c.getGasPrice(),c.getBalance({address:account})])
  const gas=estimate*125n/100n,gasPrice=price*120n/100n+1n,maximumCost=value+gas*gasPrice
  if (maximumCost>BUDGET) throw Error('本次最大费用超出 0.1 BNB 预算')
  if(balance<maximumCost)throw Error(`BNB 不足，需要最多 ${formatEther(maximumCost)} BNB（含网络费）`)
  return {account,to,data,value,gas,gasPrice,maximumCost,createdAt:Date.now(),label}
}
export type RecordEntry = {hash:Hex;account:Address;to:Address;label:string;status:'pending'|'success'|'reverted';reserved:string;cost?:string;token?:Address;vault?:Address;time:number}
const journalKey='butterfly-vault-transactions-v1'
export function records():RecordEntry[]{try{const r=JSON.parse(localStorage.getItem(journalKey)||'[]');return Array.isArray(r)?r.filter(x=>/^0x[0-9a-fA-F]{64}$/.test(x.hash)).slice(-100):[]}catch{return []}}
function save(entry:RecordEntry){const all=records().filter(r=>r.hash!==entry.hash);localStorage.setItem(journalKey,JSON.stringify([...all,entry].slice(-100)))}
export function budgetUsed(account:Address){return records().filter(r=>r.account.toLowerCase()===account.toLowerCase()).reduce((sum,r)=>sum+BigInt(r.cost??r.reserved),0n)}
export async function identity(wallet:WalletClient,account:Address){if(await wallet.getChainId()!==56)throw Error('请切换到 BNB Chain 后重新检查');const [now]=await wallet.getAddresses();if(now?.toLowerCase()!==account.toLowerCase())throw Error('钱包账号已变化，请重新连接和检查')}
export async function submit(c:PublicClient,wallet:WalletClient,p:Prepared,onHash:(hash:Hex)=>void){
  await identity(wallet,p.account)
  if(Date.now()-p.createdAt>120000)throw Error('交易检查已过期，请重新检查')
  if(records().some(r=>r.account.toLowerCase()===p.account.toLowerCase()&&r.status==='pending'))throw Error('已有待确认交易，请先检查交易记录，避免重复发送')
  if(budgetUsed(p.account)+p.maximumCost>BUDGET)throw Error('本浏览器累计执行费用将超过 0.1 BNB，请检查交易记录')
  await c.call({account:p.account,to:p.to,data:p.data,value:p.value})
  const estimate=await c.estimateGas({account:p.account,to:p.to,data:p.data,value:p.value})
  if(estimate>p.gas||await c.getGasPrice()>p.gasPrice)throw Error('网络费用发生变化，请重新检查')
  if(await c.getBalance({address:p.account})<p.maximumCost)throw Error('钱包余额已不足，请重新检查')
  await identity(wallet,p.account)
  // Test browser storage before signature. A hash is persisted before receipt polling.
  localStorage.setItem(journalKey,JSON.stringify(records()))
  const hash=await wallet.sendTransaction({chain:bsc,account:p.account,to:p.to,data:p.data,value:p.value,gas:p.gas,gasPrice:p.gasPrice})
  try { save({hash,account:p.account,to:p.to,label:p.label,status:'pending',reserved:p.maximumCost.toString(),time:Date.now()}) } finally { onHash(hash) }
  return await checkReceipt(c,hash)
}
export async function checkReceipt(c:PublicClient,hash:Hex){
  const previous=records().find(r=>r.hash===hash);if(!previous)throw Error('找不到交易记录')
  const receipt=await c.waitForTransactionReceipt({hash,confirmations:2,timeout:60000})
  const tx=await c.getTransaction({hash})
  if(tx.from.toLowerCase()!==previous.account.toLowerCase()||tx.to?.toLowerCase()!==previous.to.toLowerCase())throw Error('交易发送人与目标不匹配')
  const updated:RecordEntry={...previous,status:receipt.status,cost:(receipt.gasUsed*receipt.effectiveGasPrice+(receipt.status==='success'?tx.value:0n)).toString()}
  if(receipt.status==='success')for(const log of receipt.logs){if(log.address.toLowerCase()!==VAULT_PORTAL.toLowerCase())continue;try{const decoded=decodeEventLog({abi:launchAbi,data:log.data,topics:log.topics});if(decoded.eventName==='FlapTaxVaultTokenCreated'){updated.token=decoded.args.token;updated.vault=decoded.args.vault}}catch{/* Other portal events */}}
  if(updated.token&&updated.vault){const info=await c.readContract({address:VAULT_PORTAL,abi:launchAbi,functionName:'getVault',args:[updated.token]});if(info.vault.toLowerCase()!==updated.vault.toLowerCase())throw Error('回执和链上金库地址不一致')}
  save(updated);return updated
}
export function message(error:unknown){const e=error as {shortMessage?:string;message?:string};return (e.shortMessage||e.message||String(error)).slice(0,650)}
