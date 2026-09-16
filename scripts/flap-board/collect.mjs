import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createPublicClient,http,erc20Abi} from 'viem'
import {bsc} from 'viem/chains'
import {categories,factories,marketFields,scanLogs} from './core.mjs'
const abi=JSON.parse(await readFile(new URL('./abi.json',import.meta.url),'utf8'))
const seeds=JSON.parse(await readFile(new URL('./seeds.json',import.meta.url),'utf8'))
const portal='0xe2ce6ab80874fa9fa2aae65d277dd6b8e65c9de0',vaultPortal='0x90497450f2a706f1951b5bdda52b4e5d16f34c06'
const branch='automation/flap-board-data',repo=process.env.GITHUB_REPOSITORY||'xuxi1234/flap-stock-meme'
const rpc=process.env.FLAP_BSC_RPC_URL
if(!rpc)throw Error('FLAP_BSC_RPC_URL is required; no signer is used')
const client=createPublicClient({chain:bsc,transport:http(rpc,{timeout:10000,retryCount:1})})
async function github(path,method='GET',body){
 const r=await fetch(`https://api.github.com/repos/${repo}/${path}`,{method,headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)})
 if(r.status===404&&method==='GET')return null
 if(!r.ok)throw Error(`Snapshot storage HTTP ${r.status}`)
 return r.json()
}
async function loadState(){
 const ref=await github(`git/ref/heads/${branch}`)
 if(!ref)return {ref:null,state:{tokens:Object.fromEntries(seeds.map(t=>[t.address,t]))}}
 const file=await github(`contents/state.json?ref=${branch}`)
 if(!file?.content)throw Error('Existing checkpoint cannot be read')
 return {ref:ref.object.sha,state:JSON.parse(Buffer.from(file.content,'base64').toString())}
}
async function publish(state,snapshot,oldRef){
 const tree=await github('git/trees','POST',{tree:[
  {path:'state.json',mode:'100644',type:'blob',content:JSON.stringify(state)},
  {path:'snapshot.json',mode:'100644',type:'blob',content:JSON.stringify(snapshot)},
  {path:'vercel.json',mode:'100644',type:'blob',content:JSON.stringify({git:{deploymentEnabled:false}})},
 ]})
 const commit=await github('git/commits','POST',{message:`Refresh Flap chain snapshot ${new Date(snapshot.updatedAt).toISOString()} [skip ci]`,tree:tree.sha,parents:oldRef?[oldRef]:[]})
 if(oldRef)await github(`git/refs/heads/${branch}`,'PATCH',{sha:commit.sha,force:false})
 else await github('git/refs','POST',{ref:`refs/heads/${branch}`,sha:commit.sha})
 return commit.sha
}
async function ingest(state,from,to){
 for(let start=from;start<=to;start+=2000n){
  const end=start+1999n<to?start+1999n:to
  for(const [address,name] of [[portal,'TokenCreated'],[vaultPortal,'FlapTaxVaultTokenCreated']]){
   const logs=await scanLogs(client,address,abi.find(a=>a.name===name),start,end)
   for(const l of logs){
    const a=l.args.token.toLowerCase(),old=state.tokens[a]||{address:a}
    state.tokens[a]={...old,block:Number(l.blockNumber),...(name==='TokenCreated'?{name:l.args.name,symbol:l.args.symbol}:{factory:l.args.vaultFactory.toLowerCase()})}
   }
  }
 }
}
async function multicall(contracts,blockNumber){
 const out=[]
 for(let i=0;i<contracts.length;i+=60)out.push(...await client.multicall({contracts:contracts.slice(i,i+60),blockNumber,allowFailure:true,batchSize:0}))
 return out
}
async function cycle(state,oldRef){
 if(await client.getChainId()!==56)throw Error('Expected BNB Chain')
 const head=await client.getBlockNumber()-24n
 if(state.cursor&&head<BigInt(state.cursor))throw Error('RPC behind checkpoint')
 const from=state.cursor?BigInt(state.cursor)+1n:head-6000n
 // Checkpoints advance only after complete successful range reads. No skipped gaps.
 const to=from+11999n<head?from+11999n:head
 await ingest(state,from,to)
 state.cursor=Number(to)
 if(!state.historyCursor)state.historyCursor=Number(from)
 const backTo=BigInt(state.historyCursor)-1n,backFrom=backTo>20000n?backTo-19999n:0n
 if(backTo>=0n && head-backTo<3_000_000n){await ingest(state,backFrom,backTo);state.historyCursor=Number(backFrom)}
 // Rare vault classes need a deeper, topic-filtered history than recent launches.
 let targetTo=BigInt(state.factoryCursor||Number(head))
 if(head-targetTo<10_000_000n){
  const event=abi.find(a=>a.name==='FlapTaxVaultTokenCreated')
  const known=[...Object.values(factories).flat(),'0x7c8781b21fb004308a5a2bb7f9cb1e2e6bd1fc7e']
  for(let i=0;i<10;i++){
   const start=targetTo>19999n?targetTo-19999n:0n
   for(const l of await scanLogs(client,vaultPortal,event,start,targetTo,{vaultFactory:known})){
    const a=l.args.token.toLowerCase();state.tokens[a]={...state.tokens[a],address:a,block:Number(l.blockNumber),factory:l.args.vaultFactory.toLowerCase()}
   }
   targetTo=start-1n;if(targetTo<0n)break
  }
  state.factoryCursor=Number(targetTo)
 }
 const all=Object.values(state.tokens).sort((a,b)=>(b.block||0)-(a.block||0))
 // Retain recent launches plus independently selected factory categories and known active seeds.
 const chosen=new Map(seeds.map(t=>[t.address,state.tokens[t.address]||t]))
 for(const list of Object.values(factories))for(const t of all.filter(t=>list.includes(t.factory)).slice(0,35))chosen.set(t.address,t)
 for(const factory of new Set(all.map(t=>t.factory).filter(Boolean)))for(const t of all.filter(t=>t.factory===factory).slice(0,2))chosen.set(t.address,t)
 for(const t of all.slice(0,100))chosen.set(t.address,t)
 const selected=[...chosen.values()].slice(0,240)
 const calls=selected.flatMap(t=>[
  {address:portal,abi,functionName:'getTokenV8Safe',args:[t.address]},
  {address:vaultPortal,abi,functionName:'tryGetVault',args:[t.address]},
  {address:vaultPortal,abi,functionName:'getVaultCategory',args:[t.address]},
  {address:t.address,abi:erc20Abi,functionName:'name'},
  {address:t.address,abi:erc20Abi,functionName:'symbol'},
 ])
 const results=await multicall(calls,head),records=[],diagnostics={selected:selected.length,stateFailures:0,vaultFailures:0,categoryFailures:0,statuses:{}}
 for(let i=0;i<selected.length;i++){
  const [s,v,c,n,y]=results.slice(i*5,i*5+5),t=selected[i]
  if(s.status!=='success'){diagnostics.stateFailures++;continue}
  diagnostics.statuses[s.result.status]=(diagnostics.statuses[s.result.status]||0)+1
  if(v.status!=='success')diagnostics.vaultFailures++
  if(c.status!=='success')diagnostics.categoryFailures++
  if(![1,4].includes(s.result.status))continue
  const state=s.result,tags=categories(state,v.status==='success'?v.result:undefined,c.status==='success'?c.result:undefined)
  if(v.status==='success'&&v.result[0])t.factory=v.result[1].vaultFactory.toLowerCase()
  records.push({tags,pool:state.pool,coin:{address:t.address,name:n.result||t.name||t.address,symbol:y.result||t.symbol||t.address.slice(0,8)},listed:state.status===4,quoteToken:state.quoteTokenAddress,progress:Number(state.progress)/1e16,tax:{buyTaxBps:Number(state.buyTaxRate),sellTaxBps:Number(state.sellTaxRate)},isLowRisk:tags.includes('fac'),isInnovation:tags.includes('innovation')})
 }
 if(records.length<Math.min(5,selected.length))throw Error('Too few verified chain records; preserve last good snapshot')
 let marketOk=0
 for(let i=0;i<records.length;i+=30){
  const batch=records.slice(i,i+30)
  try{
   const r=await fetch(`https://api.dexscreener.com/tokens/v1/bsc/${batch.map(t=>t.coin.address).join(',')}`,{signal:AbortSignal.timeout(8000)})
   if(!r.ok)throw Error('Market source unavailable')
   const pairs=await r.json();if(!Array.isArray(pairs))throw Error('Invalid market response')
   for(const t of batch){const m=marketFields(pairs,t.coin.address,t.pool);Object.assign(t,m);t.coin.image=m.coinImage;if(m.price!=null)marketOk++}
  }catch{/* Unknown market fields stay null, never pretend old prices are fresh. */}
 }
 records.sort((a,b)=>(b.volume24h||0)-(a.volume24h||0))
 const snapshot={version:1,chainId:56,updatedAt:Date.now(),block:Number(head),indexedThrough:state.cursor,historyFrom:state.historyCursor,records,marketOk,diagnostics}
 // Bound the checkpoint while preserving all known supported vault categories.
 const keep=all.filter(t=>t.factory).slice(0,2500).concat(all.slice(0,1500),seeds.map(t=>state.tokens[t.address]||t))
 state.tokens=Object.fromEntries(keep.map(t=>[t.address,t]))
 const ref=await publish(state,snapshot,oldRef)
 await mkdir('flap-board-output',{recursive:true});await writeFile('flap-board-output/status.json',JSON.stringify({...snapshot,records:undefined,count:records.length},null,2))
 console.log(JSON.stringify({updatedAt:snapshot.updatedAt,block:snapshot.block,records:records.length,marketOk,categories:Object.fromEntries(['stocks','bonding','listadao','gifts','innovation','fac'].map(k=>[k,records.filter(r=>r.tags.includes(k)).length]))}))
 return ref
}
let {state,ref}=await loadState()
const stop=Date.now()+Number(process.env.COLLECT_MINUTES||23)*60000
do{
 const started=Date.now()
 try{const next=structuredClone(state);ref=await cycle(next,ref);state=next}
 catch {console.error('Collection failed; last published snapshot and checkpoint retained.');({state,ref}=await loadState())}
 if(process.env.COLLECT_ONCE==='1')break
 await new Promise(r=>setTimeout(r,Math.max(1000,60000-(Date.now()-started))))
}while(Date.now()<stop)
