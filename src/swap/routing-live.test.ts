import {it,expect} from 'vitest'
import {createPublicClient,http,erc20Abi,parseEther} from 'viem'
import {bsc} from 'viem/chains'
import {BUTTERFLY,TOKENS,STOCK_TOKENS} from './config'
import {getQuote,candidatePaths} from './service'
import {quoteV3} from './v3'
it.skipIf(import.meta.env.VITE_SWAP_ROUTING_SMOKE!=='1')('reads Butterfly metadata and real V2 and V3 pool quotes on BSC',async()=>{
 const client=createPublicClient({chain:bsc,transport:http('https://bsc-dataseed.bnbchain.org',{timeout:10000,retryCount:0}),batch:{multicall:true}})
 const [symbol,decimals]=await Promise.all([client.readContract({address:BUTTERFLY.address,abi:erc20Abi,functionName:'symbol'}),client.readContract({address:BUTTERFLY.address,abi:erc20Abi,functionName:'decimals'})]);expect(symbol).toBe('蝴蝶股票');expect(decimals).toBe(18)
 const butterfly=await getQuote(client,TOKENS[0],BUTTERFLY,parseEther('0.001'));expect(butterfly.amountOut).toBeGreaterThan(0n);console.log('Butterfly V2 net quote',butterfly.amountOut.toString(),butterfly.path)
 const apple=STOCK_TOKENS.find(t=>t.stockSymbol==='AAPL')!;const routes=await quoteV3(client,candidatePaths(TOKENS[1],apple),parseEther('1'),await client.getBlockNumber());expect(routes.length).toBeGreaterThan(0);console.log('Apple V3 quotes',routes.map(r=>({path:r.path,fees:r.fees,out:r.amountOut.toString()})))
},180000)
