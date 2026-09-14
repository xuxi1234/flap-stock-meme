// Public chain activity only: no private lists or signing credentials.
const nodes=['https://bsc-rpc.publicnode.com','https://bsc-dataseed.bnbchain.org']
async function rpc(method:string,params:unknown[]){
 for(const node of nodes){try{const r=await fetch(node,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(4500)});const j=await r.json();if(r.ok&&!j.error)return j.result}catch{}}
 throw Error('链上名单暂时不可用，请稍后重试或导入自己的 CSV。')
}
export default async function handler(req:{method?:string},res:any){
 if(req.method!=='GET')return res.status(405).json({error:'GET required'})
 try{
 const latest=BigInt(await rpc('eth_blockNumber',[]))-20n
 const seen=new Map<string,{address:string;tx:string}>();let first=latest
 for(let offset=0;offset<16&&seen.size<240;offset++){
 first=latest-BigInt(offset)
 const block=await rpc('eth_getBlockByNumber',['0x'+first.toString(16),true])
 if(!block?.transactions)throw Error('区块读取失败')
 for(const tx of block.transactions){const address=tx.from?.toLowerCase();if(/^0x[0-9a-f]{40}$/.test(address)&&!seen.has(address))seen.set(address,{address,tx:tx.hash})}
 }
 const recipients:{address:string;tx:string}[]=[]
 const candidates=[...seen.values()].slice(0,320)
 for(let i=0;i<candidates.length&&recipients.length<220;i+=20){
 const group=candidates.slice(i,i+20)
 const codes=await Promise.all(group.map(row=>rpc('eth_getCode',[row.address,'latest'])))
 group.forEach((row,k)=>{if(codes[k]==='0x'&&recipients.length<220)recipients.push(row)})
 }
 if(recipients.length<200)throw Error('当前窗口的有效地址不足 200 个，请重试或导入名单。')
 res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=60')
 return res.status(200).json({chainId:56,source:'BNB Chain 近期交易发起钱包（非持币人名单）',fromBlock:first.toString(),toBlock:latest.toString(),generatedAt:new Date().toISOString(),recipients})
 }catch(e){res.setHeader('Cache-Control','no-store');return res.status(503).json({error:(e as Error).message})}
}
