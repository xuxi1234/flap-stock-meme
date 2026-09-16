import {normalizeTrades} from '../src/swap/trades.js'
type Request={method?:string;query:Record<string,string|string[]|undefined>}
type Response={setHeader:(k:string,v:string)=>void;status:(code:number)=>Response;json:(value:unknown)=>void}
export default async function handler(req:Request,res:Response){
  if(req.method!=='GET'){res.setHeader('Allow','GET');res.status(405).json({error:'GET required'});return}
  const {pool,token}=req.query
  if(typeof pool!=='string'||typeof token!=='string'||![pool,token].every(a=>/^0x[0-9a-fA-F]{40}$/.test(a))){res.status(400).json({error:'Invalid pool or token'});return}
  try{
    const response=await fetch(`https://api.geckoterminal.com/api/v2/networks/bsc/pools/${pool.toLowerCase()}/trades`,{headers:{Accept:'application/json;version=20230302'},signal:AbortSignal.timeout(8000),redirect:'error'})
    if(!response.ok)throw Error('Provider unavailable')
    const raw=await response.json(),trades=normalizeTrades(raw?.data,token)
    res.setHeader('Cache-Control','public, s-maxage=30, stale-while-revalidate=60')
    res.status(200).json({pool:pool.toLowerCase(),token:token.toLowerCase(),fetchedAt:Date.now(),trades})
  }catch{res.setHeader('Cache-Control','no-store');res.status(503).json({error:'成交数据暂不可用，请稍后刷新。'})}
}
