// Factory identities: Flap official developer docs and public BNB vault registry,
// inspected 2026-09-16. Unknown factories are never guessed from names/suffixes.
export const factories = {
  stocks: ['0xf8ac088f06d155f3c3f531f1ef80b14f1604530a','0x40a9a2fda017e0923ea0b403f2f063f9e51168fb','0x5418f7e8ff90354db0ecd48c8b710219244eb3c5'],
  gifts: ['0x025549f52b03cf36f9e1a337c02d3aa7af66ab32','0xfb7ccc4fd09da5b7016a18d51e227af4abe53f44','0x6909ad1822ece349cddab98e6f62eeed9faa2e10'],
  listadao: ['0x98cadb60545cccf60af94c161714420c21e7cbc2','0x845c25cee4f046663756d1245739e260ca70074c','0x4c126de52d91ef2b5b29305733dd4d81f5ab8b05','0xc7c58c0b8e884b0f8cdbe918f3ab84881b59bcab','0x4b9d1bcd1bbb85e88c01878606c2e5e132c8571e','0x551621e9d5def97329f8aff40cec0a44a0f5af94','0x6bbe8078cb250cb583e722864262d3b977d2bb57','0xb1654899c4178f82496e89c03c16d7f88fa3d0e9','0x0253481ed4bd401c232f8e2ba90d5e9d8d351a44','0x16cd09b30cbbcd5462c86ae4ae2545617a2a911c','0x69a59a1365abae19f07206287b025e9c3bcde37f'],
}
export function categories(state, vault, category) {
  const result = ['trending']
  if (state.status === 1) result.push('bonding')
  if (vault?.[0]) {
    const info = vault[1], factory = info.vaultFactory.toLowerCase()
    for (const [key, addresses] of Object.entries(factories)) if (addresses.includes(factory)) result.push(key)
    if (info.riskLevel === 1) result.push('fac')
    // Explicit on-chain AI/oracle category, not an invented Flap editorial label.
    if (category === 1) result.push('innovation')
  }
  return result
}
export function marketFields(pairs, address, pool) {
  if (!Array.isArray(pairs) || typeof address !== 'string' || typeof pool !== 'string') return {}
  const p = pairs.find(p => p?.chainId === 'bsc' && typeof p.baseToken?.address === 'string' && p.baseToken.address.toLowerCase() === address.toLowerCase() && typeof p.pairAddress === 'string' && p.pairAddress.toLowerCase() === pool.toLowerCase())
  if (!p) return {}
  const n = (v, signed=false) => {
    if (!(typeof v === 'number' || typeof v === 'string' && /^-?(?:[0-9]+(?:\.[0-9]+)?)(?:e[+-]?[0-9]+)?$/i.test(v))) return null
    const value=Number(v);return Number.isFinite(value) && (signed || value>=0) ? value : null
  }
  return {price:n(p.priceUsd),marketCap:n(p.marketCap),liquidity:n(p.liquidity?.usd),volume24h:n(p.volume?.h24),change5m:n(p.priceChange?.m5,true),change1h:n(p.priceChange?.h1,true),change4h:null,change24h:n(p.priceChange?.h24,true),coinImage:typeof p.info?.imageUrl==='string'?p.info.imageUrl:null}
}
// Only Portal-verified graduated records enter this fallback. Never select another pool.
export async function fillPoolFallback(records,{fetcher=fetch,pause=ms=>new Promise(r=>setTimeout(r,ms)),now=Date.now}={}) {
 const valid=a=>typeof a==='string' && /^0x[0-9a-f]{40}$/i.test(a) && !/^0x0{40}$/i.test(a)
 const candidates=records.filter(r=>r.listed===true && r.price==null && valid(r.pool) && valid(r.coin?.address))
 const diagnostics={eligible:candidates.length,requested:0,filled:0,missing:0,failed:0,rateLimited:false,deferred:0}
 const deadline=now()+15000
 for(const record of candidates){
  if(diagnostics.requested>=30 || now()>=deadline)break
  if(diagnostics.requested)await pause(250)
  if(now()>=deadline)break
  diagnostics.requested++
  try {
   const response=await fetcher(`https://api.dexscreener.com/latest/dex/pairs/bsc/${record.pool.toLowerCase()}`,{redirect:'error',signal:AbortSignal.timeout(Math.max(1,Math.min(4000,deadline-now()))),headers:{Accept:'application/json'}})
   if(response.status===429){diagnostics.rateLimited=true;await response.body?.cancel();break}
   if(!response.ok)throw Error('Pool source unavailable')
   const reader=response.body?.getReader();if(!reader)throw Error('Missing body')
   const chunks=[];let size=0
   try {for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>256000)throw Error('Pool response too large');chunks.push(value)}}
   finally{await reader.cancel()}
   const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length}
   const data=JSON.parse(new TextDecoder().decode(bytes))
   if(!Array.isArray(data?.pairs) || data.pairs.length>100){diagnostics.missing++;continue}
   const fields=marketFields(data.pairs,record.coin.address,record.pool)
   if(fields.price==null){diagnostics.missing++;continue}
   // Fill unknown values only; do not erase already collected values with nulls.
   for(const [key,value] of Object.entries(fields))if(record[key]==null && value!=null)record[key]=value
   if(record.coin.image==null && fields.coinImage!=null)record.coin.image=fields.coinImage
   diagnostics.filled++
  } catch {diagnostics.failed++}
 }
 diagnostics.deferred=candidates.length-diagnostics.requested
 return diagnostics
}
export async function scanLogs(client, address, event, fromBlock, toBlock, args) {
  if (fromBlock > toBlock) return []
  try { return await client.getLogs({address,event,fromBlock,toBlock,args,strict:true}) }
  catch {
    if (toBlock-fromBlock < 10n) throw Error('RPC log range unavailable')
    const mid=(fromBlock+toBlock)/2n
    return [...await scanLogs(client,address,event,fromBlock,mid,args),...await scanLogs(client,address,event,mid+1n,toBlock,args)]
  }
}
