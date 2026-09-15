import {CHART_PERIODS,normalizeCandles} from '../src/swap/chartData.js'
type Request={method?:string;query:Record<string,string|string[]|undefined>}
type Response={setHeader:(k:string,v:string)=>void;status:(code:number)=>Response;json:(value:unknown)=>void}
const addressPattern=/^0x[0-9a-fA-F]{40}$/
const base='https://api.geckoterminal.com/api/v2'
async function json(path:string){
 const response=await fetch(base+path,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(7000),redirect:'error'})
 if(!response.ok)throw Error('Chart provider unavailable')
 return response.json()
}
export default async function handler(req:Request,res:Response){
 if(req.method!=='GET'){res.setHeader('Allow','GET');res.status(405).json({error:'GET required'});return}
 const {token,period='1h'}=req.query
 if(typeof token!=='string'||!addressPattern.test(token)||typeof period!=='string'||!Object.hasOwn(CHART_PERIODS,period)){res.status(400).json({error:'Invalid chart request'});return}
 try{
  const normalized=token.toLowerCase()
  const pools=await json(`/networks/bsc/tokens/${normalized}/pools?page=1`)
  if(!Array.isArray(pools.data))throw Error('Missing pool list')
  const eligible=pools.data.filter((p:any)=>addressPattern.test(p?.attributes?.address??'')&&[p?.relationships?.base_token?.data?.id,p?.relationships?.quote_token?.data?.id].some(id=>typeof id==='string'&&id.toLowerCase()===`bsc_${normalized}`)&&Number(p.attributes.reserve_in_usd)>0)
  eligible.sort((a:any,b:any)=>Number(b.attributes.reserve_in_usd)-Number(a.attributes.reserve_in_usd))
  const pool=eligible[0];if(!pool)throw Error('No indexed pool')
  const selected=CHART_PERIODS[period as keyof typeof CHART_PERIODS]
  const side=pool.relationships.base_token.data.id.toLowerCase()===`bsc_${normalized}`?'base':'quote'
  const raw=await json(`/networks/bsc/pools/${pool.attributes.address.toLowerCase()}/ohlcv/${selected.timeframe}?aggregate=${selected.aggregate}&limit=120&currency=usd&token=${side}`)
  const candles=normalizeCandles(raw?.data?.attributes?.ohlcv_list)
  if(!candles.length)throw Error('No history')
  res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=120')
  res.status(200).json({token:normalized,candles,pool:pool.attributes.address.toLowerCase(),fetchedAt:Date.now()})
 }catch{res.setHeader('Cache-Control','no-store');res.status(503).json({error:'该资产的历史行情暂不可用，兑换报价可独立查询。'})}
}
