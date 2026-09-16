export type PoolTrade = { id:string; hash:string; at:number; side:'buy'|'sell'; from:string; to:string; fromAmount:string; toAmount:string; usd:number|null }
export type TradeSnapshot = { pool:string; token:string; fetchedAt:number; trades:PoolTrade[] }
const address=/^0x[0-9a-f]{40}$/i,hash=/^0x[0-9a-f]{64}$/i
const amount=(v:unknown):v is string=>typeof v==='string'&&v.length<100&&/^\d+(\.\d+)?$/.test(v)&&Number.isFinite(Number(v))&&Number(v)>0
export function normalizeTrades(raw:unknown,token:string):PoolTrade[] {
  if(!Array.isArray(raw))throw new Error('Invalid trade response')
  const seen=new Set<string>(),result:PoolTrade[]=[]
  for(const item of raw.slice(0,300)){
    const a=item?.attributes
    if(typeof item?.id!=='string'||item.id.length>200||seen.has(item.id)||!a||!hash.test(a.tx_hash??'')||!address.test(a.from_token_address??'')||!address.test(a.to_token_address??'')||!amount(a.from_token_amount)||!amount(a.to_token_amount))continue
    const at=Date.parse(a.block_timestamp),from=a.from_token_address.toLowerCase(),to=a.to_token_address.toLowerCase(),selected=token.toLowerCase()
    if(!Number.isFinite(at)||at<=0||from===to||!([from,to].includes(selected)))continue
    seen.add(item.id)
    const usd=a.volume_in_usd==null?null:Number(a.volume_in_usd)
    result.push({id:item.id,hash:a.tx_hash,at,side:to===selected?'buy':'sell',from,to,fromAmount:a.from_token_amount,toAmount:a.to_token_amount,usd:usd!==null&&Number.isFinite(usd)&&usd>=0?usd:null})
  }
  return result.sort((a,b)=>b.at-a.at)
}
