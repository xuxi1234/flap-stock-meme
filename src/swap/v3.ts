import {parseAbi,isAddress,zeroAddress,encodeFunctionData,type Address,type Hex,type PublicClient} from 'viem'
import type {SwapToken} from './config'
// Published PancakeSwap BSC v3 deployments: developer.pancakeswap.finance/contracts/v3/addresses
export const V3_ROUTER='0x1b81D678ffb9C0263b24A97847620C99d213eB14' as const
export const V3_FACTORY='0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865' as const
export const V3_QUOTER='0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997' as const
export const V3_FEES=[100,500,2500,10000] as const
export const v3Abi=parseAbi([
 'function exactInput((bytes path,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum) params) payable returns (uint256 amountOut)',
 'function multicall(bytes[] data) payable returns (bytes[] results)',
 'function unwrapWETH9(uint256 amountMinimum,address recipient) payable',
 'function refundETH() payable',
])
const factoryAbi=parseAbi(['function getPool(address,address,uint24) view returns(address)'])
const poolAbi=parseAbi(['function slot0() view returns(uint160 sqrtPriceX96,int24 tick,uint16 observationIndex,uint16 observationCardinality,uint16 observationCardinalityNext,uint32 feeProtocol,bool unlocked)'])
const quoterAbi=parseAbi(['function quoteExactInput(bytes path,uint256 amountIn) returns(uint256 amountOut,uint160[] sqrtPriceX96AfterList,uint32[] initializedTicksCrossedList,uint256 gasEstimate)'])
export type V3Route={protocol:'V3';path:Address[];fees:number[];amountOut:bigint;impactBps:number}
export function encodeV3Path(path:Address[],fees:number[]):Hex {
 if(path.length<2||path.length>3||fees.length!==path.length-1||new Set(path.map(a=>a.toLowerCase())).size!==path.length||path.some(a=>!isAddress(a))||fees.some(f=>!V3_FEES.includes(f as typeof V3_FEES[number])))throw Error('Invalid V3 path')
 return ('0x'+path.map((a,i)=>a.slice(2)+(i<fees.length?fees[i].toString(16).padStart(6,'0'):'')).join('')) as Hex
}
export async function quoteV3(client:PublicClient,paths:Address[][],amountIn:bigint,block:bigint):Promise<V3Route[]> {
 const cache=new Map<string,Promise<{fee:number;sqrt:bigint}[]>>()
 const pools=(a:Address,b:Address)=>{
  const key=[a.toLowerCase(),b.toLowerCase()].sort().join(':')
  if(!cache.has(key))cache.set(key,Promise.allSettled(V3_FEES.map(async fee=>{
   const address=await client.readContract({address:V3_FACTORY,abi:factoryAbi,functionName:'getPool',args:[a,b,fee],blockNumber:block})
   if(typeof address!=='string'||!isAddress(address)||address===zeroAddress)throw Error('No pool')
   const slot=await client.readContract({address,abi:poolAbi,functionName:'slot0',blockNumber:block});if(slot[0]<=0n||!slot[6])throw Error('Pool unavailable')
   return {fee,sqrt:slot[0]}
  })).then(rows=>rows.flatMap(r=>r.status==='fulfilled'?[r.value]:[])))
  return cache.get(key)!
 }
 const routes=await Promise.all(paths.filter(p=>p.length<=3).map(async path=>{
  const edges=await Promise.all(path.slice(0,-1).map((a,i)=>pools(a,path[i+1])))
  let combinations:{fee:number;sqrt:bigint}[][]=[[]]
  for(const edge of edges)combinations=combinations.flatMap(prefix=>edge.map(pool=>[...prefix,pool]))
  return combinations.map(hops=>({path,hops}))
 }))
 const candidates=routes.flat();const out:V3Route[]=[]
 // Bound quoter concurrency; a missing/reverting pool never suppresses valid V2 routes.
 for(let offset=0;offset<candidates.length;offset+=6){
  const results=await Promise.allSettled(candidates.slice(offset,offset+6).map(async({path,hops})=>{
   const fees=hops.map(h=>h.fee)
   const {result}=await client.simulateContract({address:V3_QUOTER,abi:quoterAbi,functionName:'quoteExactInput',args:[encodeV3Path(path,fees),amountIn],blockNumber:block})
   const amountOut=result[0];if(amountOut<=0n)throw Error('Zero quote')
   let marginal=amountIn
   for(let i=0;i<hops.length;i++){const {sqrt,fee}=hops[i],square=sqrt*sqrt,q192=2n**192n; marginal=path[i].toLowerCase()<path[i+1].toLowerCase()?marginal*square/q192:marginal*q192/square;marginal=marginal*BigInt(1_000_000-fee)/1_000_000n}
   if(marginal<=0n)throw Error('Cannot estimate price impact')
   return {protocol:'V3' as const,path,fees,amountOut,impactBps:marginal>amountOut?Number((marginal-amountOut)*10000n/marginal):0}
  }))
  out.push(...results.flatMap(r=>r.status==='fulfilled'?[r.value]:[]))
 }
 return out
}
export function v3SwapCall(q:{input:SwapToken;output:SwapToken;path:Address[];fees?:number[];amountIn:bigint},account:Address,minimumOut:bigint,deadline:bigint){
 if(q.input.buyTaxBps||q.input.sellTaxBps||q.output.buyTaxBps||q.output.sellTaxBps)throw Error('Tax tokens require V2')
 const swap=encodeFunctionData({abi:v3Abi,functionName:'exactInput',args:[{path:encodeV3Path(q.path,q.fees??[]),recipient:q.output.native?V3_ROUTER:account,deadline,amountIn:q.amountIn,amountOutMinimum:minimumOut}]})
 const data:Hex[]=[swap]
 if(q.output.native)data.push(encodeFunctionData({abi:v3Abi,functionName:'unwrapWETH9',args:[minimumOut,account]}))
 if(q.input.native)data.push(encodeFunctionData({abi:v3Abi,functionName:'refundETH'}))
 return {address:V3_ROUTER,abi:v3Abi,functionName:'multicall' as const,args:[data] as const,account,value:q.input.native?q.amountIn:undefined}
}
