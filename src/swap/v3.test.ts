import { describe,it,expect,vi } from 'vitest'
import {decodeFunctionData, type PublicClient, type Address} from 'viem'
import {TOKENS,selectedPair} from './config'
import {getQuote,swapCall,getAllowance,minimumReceived,type SwapReview} from './service'
const flap='0x4b112e1ed0c0cb332d2b39e5dae3bba882f67777'
const account='0x0000000000000000000000000000000000001234' as Address
const router='0x1b81D678ffb9C0263b24A97847620C99d213eB14'
describe('butterfly registration and tax-aware output',()=>{
 it('defaults to nativeBNB and registered Butterfly with a first-party image',()=>{const p=selectedPair('');expect(p.input.native).toBe(true);expect(p.output.address.toLowerCase()).toBe(flap);expect(p.output.custom).not.toBe(true);expect(p.output.logoURI).toBe('/flap-stock-avatar.png')})
 it('deducts the3percent buy tax before applying slippage',async()=>{const token=TOKENS.find(t=>t.address.toLowerCase()===flap);expect(token).toBeDefined();const c={getChainId:async()=>56,getBlockNumber:async()=>1n,readContract:vi.fn(async({functionName,args})=>{if(functionName==='getAmountsOut')return [args[0],10000n];if(functionName==='getPair')return account;return [100000000n,100000000n,0]})};const q=await getQuote(c as unknown as PublicClient,TOKENS[0],token!,10000n);expect(q.amountOut).toBe(9700n);expect(minimumReceived(q.amountOut,50)).toBe(9651n)})
})
it('uses V3-only liquidity and routes native output to unwrap for the recipient',async()=>{
 const c={getChainId:async()=>56,getBlockNumber:async()=>100n,readContract:vi.fn(async({functionName,args})=>{if(functionName==='getPool')return args[2]===500?account:'0x0000000000000000000000000000000000000000';if(functionName==='slot0')return [2n**96n,0,0,0,0,0,true];throw Error('No V2')}),simulateContract:vi.fn(async()=>({result:[950n,[],[],100000n]}))};
 const q=await getQuote(c as unknown as PublicClient,TOKENS[1],TOKENS[0],1000n);expect(q.protocol).toBe('V3');expect(q.amountOut).toBe(950n);
 const review={quote:q,account,slippageBps:50,minimumOut:945n} as SwapReview;const call=swapCall(review);expect(call.address).toBe(router);expect(call.functionName).toBe('multicall');
 const data=(call.args as readonly [readonly `0x${string}`[]])[0];const swap=decodeFunctionData({abi:call.abi,data:data[0]});expect(swap.functionName).toBe('exactInput');const params=(swap.args as any)[0];expect(params.recipient.toLowerCase()).toBe(router.toLowerCase());expect(params.amountOutMinimum).toBe(945n);
 const unwrap=decodeFunctionData({abi:call.abi,data:data[1]});expect(unwrap.functionName).toBe('unwrapWETH9');expect((unwrap.args as any)[1].toLowerCase()).toBe(account.toLowerCase());
 const readContract=vi.fn(async()=>0n);await getAllowance({readContract} as unknown as PublicClient,q,account);expect(readContract).toHaveBeenCalledWith(expect.objectContaining({args:[account,router]}));
})
it('retains V3, Infinity and other supported DEX references without calling them executable routes',async()=>{
 const {normalizeMarkets}=await import('./marketData');const token=TOKENS[7];const base={chainId:'bsc',baseToken:{address:token.address},quoteToken:{address:TOKENS[1].address},priceUsd:'10',liquidity:{usd:1000}};
 const result=normalizeMarkets([{...base,dexId:'pancakeswap',labels:['v3'],pairAddress:account},{...base,dexId:'thena',labels:['v3'],pairAddress:'0x0000000000000000000000000000000000005678',liquidity:{usd:2000}}],[token.address])[token.address.toLowerCase()];expect(result.dex).toBe('THENA');expect(result.pools).toHaveLength(2)
})
it('deducts the sell tax from pool input and keeps taxed tokens on V2',async()=>{
 const {BUTTERFLY}=await import('./config');const simulateContract=vi.fn();
 const readContract=vi.fn(async({functionName,args})=>{if(functionName==='getAmountsOut')return [args[0],args[0]];if(functionName==='getPair')return account;return [100000000n,100000000n,0]});
 const q=await getQuote({getChainId:async()=>56,getBlockNumber:async()=>1n,readContract,simulateContract} as unknown as PublicClient,BUTTERFLY,TOKENS[0],10000n);
 expect(q.amountIn).toBe(10000n);expect(q.amountOut).toBe(9700n);expect(q.protocol).toBe('V2');expect(simulateContract).not.toHaveBeenCalled();
 expect(readContract.mock.calls.filter(([x])=>x.functionName==='getAmountsOut').every(([x])=>x.args[0]===9700n)).toBe(true);
})
it('sets native V3 input value, refunds excess BNB and rejects taxed V3 calldata',async()=>{
 const {v3SwapCall}=await import('./v3');const {BUTTERFLY}=await import('./config');
 const q={input:TOKENS[0],output:TOKENS[1],amountIn:1000n,path:[TOKENS[0].address,TOKENS[1].address],fees:[500]};
 const call=v3SwapCall(q,account,900n,9999999999n);expect(call.value).toBe(1000n);
 const data=call.args[0];expect(data).toHaveLength(2);
 const swap=decodeFunctionData({abi:call.abi,data:data[0]});expect((swap.args as any)[0].recipient).toBe(account);
 expect(decodeFunctionData({abi:call.abi,data:data[1]}).functionName).toBe('refundETH');
 expect(()=>v3SwapCall({...q,output:BUTTERFLY},account,900n,9999999999n)).toThrow('Tax tokens');
})
