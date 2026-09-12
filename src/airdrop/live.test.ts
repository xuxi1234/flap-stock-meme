import { beforeEach, describe, expect, it, vi } from 'vitest'
import { decodeFunctionData, encodeFunctionData, encodeEventTopics, encodeAbiParameters, parseAbiParameters, erc20Abi, type Address, type EIP1193Provider, type Hex } from 'viem'
import artifact from './distributor.json'
import legacyArtifact from './distributor-v1.json'
const mock=vi.hoisted(()=>({rpc:{getCode:vi.fn(),readContract:vi.fn(),estimateGas:vi.fn(),getGasPrice:vi.fn(),getBalance:vi.fn(),getTransactionCount:vi.fn(),getTransaction:vi.fn(),getTransactionReceipt:vi.fn(),waitForTransactionReceipt:vi.fn()},send:vi.fn()}))
vi.mock('viem',async original=>({...await original<typeof import('viem')>(),createPublicClient:()=>mock.rpc,createWalletClient:()=>({sendTransaction:mock.send})}))
import { abi, batch, batchSize, batchCount, confirmedRecipients, upgradeToSingleTransaction, canonicalRows, completedCount, loadTask, newTask, prepare, runStep, saveTask, spent, taskId, validateTask, type Task } from './live'
const wallet='0x1111111111111111111111111111111111111111' as Address
const token='0x2222222222222222222222222222222222222222' as Address
const to='0x3333333333333333333333333333333333333333' as Address
const dist='0x4444444444444444444444444444444444444444' as Address
const hash=('0x'+'ab'.repeat(32)) as Hex
const provider={request:vi.fn(async({method}:{method:string})=>method==='eth_chainId'?'0x38':[wallet])} as unknown as EIP1193Provider
function task(){return newTask(wallet,token,18,[{address:to,amount:'7'}],'import','0.02')}
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();Object.defineProperty(navigator,'locks',{configurable:true,value:{request:vi.fn(async(_key,_options,fn)=>fn({name:'lock'}))}});mock.rpc.getCode.mockResolvedValue(artifact.runtime);mock.rpc.readContract.mockImplementation(async({functionName})=>functionName==='decimals'?18:functionName==='balanceOf'?10n**24n:functionName==='completed'?false:0n);mock.rpc.estimateGas.mockResolvedValue(200000n);mock.rpc.getGasPrice.mockResolvedValue(100000000n);mock.rpc.getBalance.mockResolvedValue(10n**18n);mock.rpc.getTransactionCount.mockResolvedValue(0)})
describe('live distribution safety and recovery',()=>{
 it('combines cross-tier rights and has order-independent task identity',()=>{const a=canonicalRows([{address:to,amount:'4'},{address:wallet,amount:'2'},{address:to,amount:'1'}],18);const b=canonicalRows([{address:wallet,amount:'2'},{address:to,amount:'5'}],18);expect(a).toEqual(b);expect(taskId(wallet,token,a)).toBe(taskId(wallet,token,b))})
 it('restores same task without losing history and uses deterministic batch ids',()=>{const t=task();expect(task().id).toBe(t.id);expect(batch(t,0).id).toBe(batch(t,0).id);expect(batch(t,0).id).not.toBe(batch(t,1).id)})
 it('rejects modified recipients in a backup',()=>{const t=task();t.rows[0].amount='8';expect(()=>validateTask(t)).toThrow('摘要')})
 it('detects tampered historical gas accounting before a new signature',async()=>{const t=task();t.records=[{kind:'approve',hash,status:'success',gasWei:'1'}];mock.rpc.getTransactionReceipt.mockResolvedValue({from:wallet,status:'success',gasUsed:10n,effectiveGasPrice:2n});await expect(prepare(t)).rejects.toThrow('历史交易记录');expect(mock.send).not.toHaveBeenCalled()})
 it('blocks deployment when token balance is insufficient',async()=>{mock.rpc.readContract.mockImplementation(async({functionName})=>functionName==='decimals'?18:0n);await expect(prepare(task())).rejects.toThrow('余额不足');expect(mock.rpc.estimateGas).not.toHaveBeenCalled()})
 it('blocks allowance to mismatching runtime',async()=>{const t=task();t.distributor=dist;mock.rpc.getCode.mockResolvedValue('0x00');await expect(prepare(t)).rejects.toThrow('代码不匹配')})
 it('requests exactly remaining allowance and clears existing allowance first',async()=>{const t=task();t.distributor=dist;let r=await prepare(t);expect(r.kind).toBe('approve');expect(r.data).toBe(encodeFunctionData({abi:erc20Abi,functionName:'approve',args:[dist,7n*10n**18n]}));mock.rpc.readContract.mockImplementation(async({functionName})=>functionName==='decimals'?18:functionName==='balanceOf'?10n**24n:1n);r=await prepare(t);expect(r.kind).toBe('reset');expect(r.data).toBe(encodeFunctionData({abi:erc20Abi,functionName:'approve',args:[dist,0n]}))})
 it('stops when gas upper bound exceeds remaining cumulative budget',async()=>{const t=task();t.budget='1';await expect(prepare(t)).rejects.toThrow('Gas 预算')})
 it('persists intent before wallet request and keeps ambiguous errors locked',async()=>{const t=task();const r=await prepare(t);mock.send.mockImplementation(async()=>{expect(loadTask(wallet)?.intent?.nonce).toBe(0);throw Error('network timeout')});await expect(runStep(wallet,provider,t.id,r)).rejects.toThrow('任务已锁定');expect(loadTask(wallet)?.intent).toBeTruthy();await expect(runStep(wallet,provider,t.id,r)).rejects.toThrow('未返回哈希');expect(mock.send).toHaveBeenCalledTimes(1)})
 it('explicit user rejection allows safe retry without a persisted pending intent',async()=>{const t=task();const r=await prepare(t);mock.send.mockRejectedValue({code:4001});await expect(runStep(wallet,provider,t.id,r)).rejects.toThrow('取消钱包签名');expect(loadTask(wallet)?.intent).toBeUndefined()})
 it('blocks a concurrent tab from sending',async()=>{const t=task();const r=await prepare(t);Object.defineProperty(navigator,'locks',{value:{request:async(_k:unknown,_o:unknown,fn:(x:null)=>unknown)=>fn(null)}});await expect(runStep(wallet,provider,t.id,r)).rejects.toThrow('另一个标签页');expect(mock.send).not.toHaveBeenCalled()})
 it('refuses a changed account or chain and pending unrelated wallet transaction',async()=>{const t=task();const r=await prepare(t);const wrong={request:async({method}:{method:string})=>method==='eth_chainId'?'0x1':[wallet]} as EIP1193Provider;await expect(runStep(wallet,wrong,t.id,r)).rejects.toThrow('原发送钱包');mock.rpc.getTransactionCount.mockImplementation(async({blockTag})=>blockTag==='pending'?1:0);await expect(runStep(wallet,provider,t.id,r)).rejects.toThrow('待确认交易');expect(mock.send).not.toHaveBeenCalled()})
 it('rejects receipt recovery for unrelated transaction data',async()=>{const t=task();t.intent={kind:'deploy',data:artifact.bytecode as Hex,nonce:0,gas:'200000',gasPrice:'1',createdAt:'test'};saveTask(t);mock.rpc.getTransaction.mockResolvedValue({from:wallet,to:null,input:'0x00',value:0n,nonce:0});await expect(runStep(wallet,provider,t.id,undefined,hash)).rejects.toThrow('交易与当前任务不匹配');expect(mock.send).not.toHaveBeenCalled()})
 it('reconciles a successful deployment once, without rebroadcast',async()=>{const t=task();t.intent={kind:'deploy',data:artifact.bytecode as Hex,nonce:0,gas:'200000',gasPrice:'1',createdAt:'test',hash};saveTask(t);mock.rpc.getTransaction.mockResolvedValue({from:wallet,to:null,input:artifact.bytecode,value:0n,nonce:0});mock.rpc.waitForTransactionReceipt.mockResolvedValue({status:'success',contractAddress:dist,gasUsed:100n,effectiveGasPrice:2n,logs:[]});const restored=await runStep(wallet,provider,t.id);expect(restored.distributor).toBe(dist);expect(spent(restored)).toBe(200n);expect(restored.intent).toBeUndefined();expect(mock.send).not.toHaveBeenCalled()})
 it('accepts a real-shaped taxed delivery receipt and never rebroadcasts it',async()=>{
  const t=task();t.distributor=dist;const b=batch(t,0)
  const data=encodeFunctionData({abi,functionName:'distribute',args:[token,b.id,[to],[7n*10n**18n]]})
  t.intent={kind:'send',to:dist,data,nonce:0,gas:'200000',gasPrice:'1',createdAt:'test',hash,batch:0};saveTask(t)
  mock.rpc.getTransaction.mockResolvedValue({from:wallet,to:dist,input:data,value:0n,nonce:0})
  const logs=[
   {address:dist,topics:encodeEventTopics({abi,eventName:'Delivered',args:{sender:wallet,batchId:b.id,token}}),data:encodeAbiParameters(parseAbiParameters('address,uint256,uint256'),[to,7n*10n**18n,679n*10n**16n])},
   {address:dist,topics:encodeEventTopics({abi,eventName:'BatchCompleted',args:{sender:wallet,batchId:b.id,token}}),data:encodeAbiParameters(parseAbiParameters('uint256,uint256'),[1n,7n*10n**18n])}
  ]
  mock.rpc.waitForTransactionReceipt.mockResolvedValue({status:'success',gasUsed:100n,effectiveGasPrice:2n,logs})
  const done=await runStep(wallet,provider,t.id)
  expect(completedCount(done)).toBe(1);expect(done.records[0].received?.[0].received).toBe((679n*10n**16n).toString());expect(done.intent).toBeUndefined();expect(mock.send).not.toHaveBeenCalled()
 })
 it('charges failed receipt gas without marking any batch complete',async()=>{const t=task();t.distributor=dist;const data=encodeFunctionData({abi,functionName:'distribute',args:[token,batch(t,0).id,[to],[7n*10n**18n]]});t.intent={kind:'send',to:dist,data,nonce:0,gas:'200000',gasPrice:'1',createdAt:'test',hash,batch:0};saveTask(t);mock.rpc.getTransaction.mockResolvedValue({from:wallet,to:dist,input:data,value:0n,nonce:0});mock.rpc.waitForTransactionReceipt.mockResolvedValue({status:'reverted',gasUsed:100n,effectiveGasPrice:2n,logs:[]});await expect(runStep(wallet,provider,t.id)).rejects.toThrow('链上失败');const saved=loadTask(wallet) as Task;expect(spent(saved)).toBe(200n);expect(completedCount(saved)).toBe(0);expect(saved.intent).toBeUndefined()})
})

describe('single-transaction 200 recipients and legacy task migration',()=>{
 const recipients=()=>Array.from({length:200},(_,i)=>({address:('0x'+(1000+i).toString(16).padStart(40,'0')),amount:'7'}))
 it('encodes all 200 recipients and 1400 tokens in exactly one send call',async()=>{
  const t=newTask(wallet,token,18,recipients(),'random','0.02');t.distributor=dist;saveTask(t)
  const total=1400n*10n**18n
  mock.rpc.readContract.mockImplementation(async({functionName})=>functionName==='decimals'?18:functionName==='balanceOf'?total:functionName==='allowance'?total:false)
  const ready=await prepare(t)
  expect(ready.kind).toBe('send');expect(batchSize(t)).toBe(200);expect(ready.description).toContain('1 / 1')
  const decoded=decodeFunctionData({abi,data:ready.data!})
  expect(decoded.functionName).toBe('distribute')
  if(decoded.functionName!=='distribute')throw Error('wrong call')
  expect(decoded.args[2]).toHaveLength(200)
  expect(decoded.args[3].every(n=>n===7n*10n**18n)).toBe(true)
  expect(mock.send).not.toHaveBeenCalled()
 })
 it('keeps old 25-address batch ids while migrating only a never-sent task and preserving gas',async()=>{
  const t=newTask(wallet,token,18,recipients(),'random','0.02');delete t.toolVersion;t.distributor=dist
  t.records=[{kind:'deploy',hash,status:'success',gasWei:'200'}];saveTask(t)
  mock.rpc.getCode.mockResolvedValue(legacyArtifact.runtime)
  mock.rpc.getTransactionReceipt.mockResolvedValue({from:wallet,status:'success',gasUsed:100n,effectiveGasPrice:2n})
  const oldId=batch(t,0).id;expect(batch(t,0).rows).toHaveLength(25)
  const upgraded=await upgradeToSingleTransaction(wallet,provider)
  expect(upgraded.rows).toEqual(t.rows);expect(spent(upgraded)).toBe(200n);expect(upgraded.id).toBe(t.id)
  expect(upgraded.retiredDistributor).toBe(dist);expect(upgraded.distributor).toBeUndefined()
  expect(batch(upgraded,0).rows).toHaveLength(200);expect(batch(upgraded,0).id).not.toBe(oldId)
  expect(mock.rpc.readContract.mock.calls.filter(([x])=>x.functionName==='completed')).toHaveLength(8)
  expect(mock.send).not.toHaveBeenCalled()
 })
 it('blocks migration with unresolved transactions, invalid history, or unrecorded old on-chain sends',async()=>{
  const t=task();delete t.toolVersion;t.distributor=dist
  t.intent={kind:'deploy',data:legacyArtifact.bytecode as Hex,nonce:0,gas:'200000',gasPrice:'1',createdAt:'test'};saveTask(t)
  await expect(upgradeToSingleTransaction(wallet,provider)).rejects.toThrow('未返回哈希')
  delete t.intent;t.records=[{kind:'send',hash,status:'success',gasWei:'1',batch:0}];saveTask(t)
  mock.rpc.getTransactionReceipt.mockResolvedValue({from:wallet,status:'success',gasUsed:1n,effectiveGasPrice:1n,logs:[]})
  await expect(upgradeToSingleTransaction(wallet,provider)).rejects.toThrow('历史批次')
  t.records=[];saveTask(t);mock.rpc.getCode.mockResolvedValue(legacyArtifact.runtime)
  mock.rpc.readContract.mockImplementation(async({functionName})=>functionName==='decimals'?18:functionName==='balanceOf'?10n**24n:functionName==='completed'?true:0n)
  await expect(upgradeToSingleTransaction(wallet,provider)).rejects.toThrow('旧工具链上发放')
  expect(loadTask(wallet)?.toolVersion).toBeUndefined();expect(mock.send).not.toHaveBeenCalled()
 })
 it('recovers the already-signed legacy deployment after the software upgrade',async()=>{
  const t=task();delete t.toolVersion;t.intent={kind:'deploy',data:legacyArtifact.bytecode as Hex,nonce:0,gas:'200000',gasPrice:'1',createdAt:'test',hash};saveTask(t)
  mock.rpc.getCode.mockResolvedValue(legacyArtifact.runtime)
  mock.rpc.getTransaction.mockResolvedValue({from:wallet,to:null,input:legacyArtifact.bytecode,value:0n,nonce:0})
  mock.rpc.waitForTransactionReceipt.mockResolvedValue({status:'success',contractAddress:dist,gasUsed:100n,effectiveGasPrice:2n,logs:[]})
  const restored=await runStep(wallet,provider,t.id)
  expect(restored.distributor).toBe(dist);expect(batchSize(restored)).toBe(25);expect(spent(restored)).toBe(200n)
  expect(mock.send).not.toHaveBeenCalled()
 })
 it('revokes the old tool allowance before any replacement deployment',async()=>{
  const t=task();t.retiredDistributor=dist;saveTask(t)
  mock.rpc.getCode.mockResolvedValue(legacyArtifact.runtime)
  mock.rpc.readContract.mockImplementation(async({functionName})=>functionName==='decimals'?18:functionName==='balanceOf'?10n**24n:functionName==='allowance'?1n:false)
  const ready=await prepare(t)
  expect(ready.kind).toBe('revoke');expect(ready.data).toBe(encodeFunctionData({abi:erc20Abi,functionName:'approve',args:[dist,0n]}))
 })
})

describe('partially completed legacy task recovery',()=>{
 function setupPartial(pending=false){
  const recipients=Array.from({length:200},(_,i)=>({address:'0x'+(1000+i).toString(16).padStart(40,'0'),amount:'7'}))
  const t=newTask(wallet,token,18,recipients,'random','0.02');delete t.toolVersion;t.distributor=dist
  const hashes=[hash,('0x'+'cd'.repeat(32)) as Hex]
  const receipts=[0,1].map(index=>{
   const b=batch(t,index)
   const logs=[...b.rows.map(r=>({address:dist,topics:encodeEventTopics({abi,eventName:'Delivered',args:{sender:wallet,batchId:b.id,token}}),data:encodeAbiParameters(parseAbiParameters('address,uint256,uint256'),[r.address,BigInt(r.amount),BigInt(r.amount)])})),
    {address:dist,topics:encodeEventTopics({abi,eventName:'BatchCompleted',args:{sender:wallet,batchId:b.id,token}}),data:encodeAbiParameters(parseAbiParameters('uint256,uint256'),[25n,175n*10n**18n])}]
   return {from:wallet,status:'success',gasUsed:100n,effectiveGasPrice:2n,logs}
  })
  t.records=[{kind:'send',hash:hashes[0],status:'success',gasWei:'200',batch:0}]
  if(pending){
   const b=batch(t,1);const data=encodeFunctionData({abi,functionName:'distribute',args:[token,b.id,b.rows.map(r=>r.address),b.rows.map(r=>BigInt(r.amount))]})
   t.intent={kind:'send',to:dist,data,nonce:1,gas:'200000',gasPrice:'1',createdAt:'test',hash:hashes[1],batch:1}
   mock.rpc.getTransaction.mockResolvedValue({from:wallet,to:dist,input:data,value:0n,nonce:1})
   mock.rpc.waitForTransactionReceipt.mockResolvedValue(receipts[1])
  }
  saveTask(t)
  mock.rpc.getTransactionReceipt.mockImplementation(async({hash:h})=>receipts[hashes.indexOf(h)])
  mock.rpc.getCode.mockImplementation(async({address})=>address===dist?legacyArtifact.runtime:artifact.runtime)
  const doneIds=[batch(t,0).id,...(pending?[batch(t,1).id]:[])]
  mock.rpc.readContract.mockImplementation(async({functionName,args,address})=>functionName==='decimals'?18:functionName==='balanceOf'?10n**24n:functionName==='completed'?doneIds.includes(args[1]):functionName==='allowance'?(address===token&&args[1]===dist?0n:BigInt(pending?1050:1225)*10n**18n):0n)
  return {t,doneIds}
 }
 it('keeps the first 25 deliveries and encodes only the remaining 175 addresses once',async()=>{
  const {t}=setupPartial()
  const upgraded=await upgradeToSingleTransaction(wallet,provider)
  expect(upgraded.rows).toEqual(t.rows);expect(upgraded.legacySentRows).toBe(25)
  expect(confirmedRecipients(upgraded)).toBe(25);expect(batchCount(upgraded)).toBe(1);expect(completedCount(upgraded)).toBe(0)
  expect(spent(upgraded)).toBe(200n);expect(upgraded.records[0].layout).toBe('legacy')
  upgraded.distributor='0x5555555555555555555555555555555555555555';saveTask(upgraded)
  const ready=await prepare(upgraded)
  expect(ready.kind).toBe('send')
  const decoded=decodeFunctionData({abi,data:ready.data!})
  if(decoded.functionName!=='distribute')throw Error('wrong call')
  expect(decoded.args[2].map(a=>a.toLowerCase())).toEqual(t.rows.slice(25).map(r=>r.address))
  expect(decoded.args[3].reduce((a,b)=>a+b,0n)).toBe(1225n*10n**18n)
  expect(new Set([...t.rows.slice(0,25).map(r=>r.address),...decoded.args[2].map(a=>a.toLowerCase())]).size).toBe(200)
  expect(mock.send).not.toHaveBeenCalled()
  const modified={...upgraded,legacySentRows:50}
  expect(()=>validateTask(modified)).toThrow('跳过数量')
 })
 it('resolves the in-flight second batch first, then excludes all 50 confirmed recipients',async()=>{
  const {t}=setupPartial(true)
  const upgraded=await upgradeToSingleTransaction(wallet,provider)
  expect(upgraded.intent).toBeUndefined();expect(upgraded.legacySentRows).toBe(50)
  expect(spent(upgraded)).toBe(400n);expect(confirmedRecipients(upgraded)).toBe(50)
  expect(batch(upgraded,0).rows).toEqual(t.rows.slice(50));expect(batchCount(upgraded)).toBe(1)
  expect(upgraded.records.every(r=>r.layout==='legacy')).toBe(true)
  const newDist='0x5555555555555555555555555555555555555555' as Address
  const newHash=('0x'+'ef'.repeat(32)) as Hex
  upgraded.distributor=newDist
  const remaining=batch(upgraded,0)
  const data=encodeFunctionData({abi,functionName:'distribute',args:[token,remaining.id,remaining.rows.map(r=>r.address),remaining.rows.map(r=>BigInt(r.amount))]})
  upgraded.intent={kind:'send',to:newDist,data,nonce:2,gas:'200000',gasPrice:'1',createdAt:'test',hash:newHash,batch:0};saveTask(upgraded)
  mock.rpc.getTransaction.mockResolvedValue({from:wallet,to:newDist,input:data,value:0n,nonce:2})
  const logs=[...remaining.rows.map(r=>({address:newDist,topics:encodeEventTopics({abi,eventName:'Delivered',args:{sender:wallet,batchId:remaining.id,token}}),data:encodeAbiParameters(parseAbiParameters('address,uint256,uint256'),[r.address,BigInt(r.amount),BigInt(r.amount)])})),
   {address:newDist,topics:encodeEventTopics({abi,eventName:'BatchCompleted',args:{sender:wallet,batchId:remaining.id,token}}),data:encodeAbiParameters(parseAbiParameters('uint256,uint256'),[150n,1050n*10n**18n])}]
  mock.rpc.waitForTransactionReceipt.mockResolvedValue({status:'success',gasUsed:100n,effectiveGasPrice:2n,logs})
  const finished=await runStep(wallet,provider,upgraded.id)
  expect(completedCount(finished)).toBe(1);expect(confirmedRecipients(finished)).toBe(200)
  expect(spent(finished)).toBe(600n);expect(finished.records).toHaveLength(3)
  expect(finished.records[2].received).toHaveLength(150)
  expect(mock.send).not.toHaveBeenCalled()
 })
 it('stops if another legacy batch gets sent after migration',async()=>{
  const {t,doneIds}=setupPartial()
  const upgraded=await upgradeToSingleTransaction(wallet,provider)
  doneIds.push(batch(t,1).id)
  await expect(prepare(upgraded)).rejects.toThrow('旧工具链上发放与本机记录不一致')
  expect(mock.send).not.toHaveBeenCalled()
 })
 it('does not merge if an earlier successful batch record is missing',async()=>{
  const {t}=setupPartial();t.records[0].batch=1;saveTask(t)
  await expect(upgradeToSingleTransaction(wallet,provider)).rejects.toThrow('历史批次')
  expect(loadTask(wallet)?.toolVersion).toBeUndefined();expect(mock.send).not.toHaveBeenCalled()
 })
})
