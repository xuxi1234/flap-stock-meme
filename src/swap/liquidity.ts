import { encodeFunctionData, erc20Abi, parseAbi, zeroAddress, type Address, type PublicClient, type WalletClient } from 'viem'
import { bsc } from 'viem/chains'
import { FACTORY, ROUTER, WBNB, factoryAbi, type SwapToken } from './config'
import { minimumReceived, readBalance, SwapError } from './service'

export const liquidityAbi = parseAbi([
  'function factory() view returns (address)',
  'function WETH() view returns (address)',
  'function addLiquidity(address tokenA,address tokenB,uint256 amountADesired,uint256 amountBDesired,uint256 amountAMin,uint256 amountBMin,address to,uint256 deadline) returns (uint256 amountA,uint256 amountB,uint256 liquidity)',
  'function addLiquidityETH(address token,uint256 amountTokenDesired,uint256 amountTokenMin,uint256 amountETHMin,address to,uint256 deadline) payable returns (uint256 amountToken,uint256 amountETH,uint256 liquidity)',
  'function removeLiquidity(address tokenA,address tokenB,uint256 liquidity,uint256 amountAMin,uint256 amountBMin,address to,uint256 deadline) returns (uint256 amountA,uint256 amountB)',
  'function removeLiquidityETH(address token,uint256 liquidity,uint256 amountTokenMin,uint256 amountETHMin,address to,uint256 deadline) returns (uint256 amountToken,uint256 amountETH)',
])
const lpAbi = parseAbi(['function token0() view returns (address)', 'function token1() view returns (address)', 'function getReserves() view returns (uint112 reserve0,uint112 reserve1,uint32 blockTimestampLast)', 'function totalSupply() view returns (uint256)', 'function balanceOf(address) view returns (uint256)'])
export type PoolPosition = { pair: Address; reserveA: bigint; reserveB: bigint; supply: bigint; owned: bigint | null; block: bigint; fetchedAt: number }
export type LiquidityReview = { mode: 'add' | 'remove'; a: SwapToken; b: SwapToken; account: Address; pool: PoolPosition; desiredA: bigint; desiredB: bigint; amountA: bigint; amountB: bigint; liquidity: bigint; minA: bigint; minB: bigint; slippage: number; expiresAt: number }
export const sameAsset = (a: SwapToken, b: SwapToken) => a.address.toLowerCase() === b.address.toLowerCase()
export function validatePair(a: SwapToken, b: SwapToken) {
  if (sameAsset(a,b)) throw new SwapError('请选择两种不同资产；BNB 与 WBNB 对应同一种池内资产。')
  if ([a,b].some(t => t.native && t.address.toLowerCase() !== WBNB.toLowerCase())) throw new SwapError('原生资产配置不正确。')
}
export function writeRestriction(a: SwapToken, b: SwapToken) {
  return [a,b].some(t => t.custom || t.buyTaxBps || t.sellTaxBps) ? '当前可查看该池。含税及未收录代币的 LP 操作尚待专项验证，暂未开放；可选择 BNB / USDT 等常用无税资产。' : ''
}
export async function readPool(client: PublicClient, a: SwapToken, b: SwapToken, account: Address | null): Promise<PoolPosition> {
  validatePair(a,b)
  if (await client.getChainId() !== 56) throw new SwapError('节点网络不匹配。')
  const block = await client.getBlockNumber()
  const pair = await client.readContract({ address: FACTORY, abi: factoryAbi, functionName: 'getPair', args: [a.address,b.address], blockNumber: block })
  if (pair === zeroAddress) return { pair, reserveA:0n,reserveB:0n,supply:0n,owned: account ? 0n : null,block,fetchedAt:Date.now() }
  const [token0, token1, reserves, supply, owned] = await Promise.all([
    client.readContract({address:pair,abi:lpAbi,functionName:'token0',blockNumber:block}),
    client.readContract({address:pair,abi:lpAbi,functionName:'token1',blockNumber:block}),
    client.readContract({address:pair,abi:lpAbi,functionName:'getReserves',blockNumber:block}),
    client.readContract({address:pair,abi:lpAbi,functionName:'totalSupply',blockNumber:block}),
    account ? client.readContract({address:pair,abi:lpAbi,functionName:'balanceOf',args:[account],blockNumber:block}) : null,
  ])
  const order = token0.toLowerCase() === a.address.toLowerCase()
  if ((order ? token1 : token0).toLowerCase() !== b.address.toLowerCase() || (order ? token0 : token1).toLowerCase() !== a.address.toLowerCase()) throw new SwapError('池资产与选择不匹配。')
  return {pair,reserveA:order?reserves[0]:reserves[1],reserveB:order?reserves[1]:reserves[0],supply,owned,block,fetchedAt:Date.now()}
}
const smaller = (a:bigint,b:bigint) => a<b?a:b
export function buildLiquidityReview(mode: 'add'|'remove', a: SwapToken, b: SwapToken, account: Address, pool: PoolPosition, desiredA: bigint, desiredB: bigint, liquidity: bigint, slippage: number): LiquidityReview {
  validatePair(a,b)
  const restriction=writeRestriction(a,b); if(restriction)throw new SwapError(restriction)
  if(pool.pair===zeroAddress || pool.supply<=0n || pool.reserveA<=0n || pool.reserveB<=0n) throw new SwapError('尚无有效的 V2 流动性池。本版支持已有池，暂不创建初始价格。')
  let amountA:bigint,amountB:bigint
  if(mode==='add') {
    if(desiredA<=0n || desiredB<=0n)throw new SwapError('两种资产的数量都必须大于 0。')
    const optimalB=desiredA*pool.reserveB/pool.reserveA
    if(optimalB<=desiredB){amountA=desiredA;amountB=optimalB}else{amountA=desiredB*pool.reserveA/pool.reserveB;amountB=desiredB}
    liquidity=smaller(amountA*pool.supply/pool.reserveA,amountB*pool.supply/pool.reserveB)
  } else {
    if(liquidity<=0n || pool.owned===null || liquidity>pool.owned)throw new SwapError('移除数量超过可用 LP 余额。')
    amountA=liquidity*pool.reserveA/pool.supply;amountB=liquidity*pool.reserveB/pool.supply
  }
  const minA=minimumReceived(amountA,slippage),minB=minimumReceived(amountB,slippage)
  if(!minA || !minB || !liquidity)throw new SwapError('数量过小，请增加数量。')
  return {mode,a,b,account,pool,desiredA,desiredB,amountA,amountB,liquidity,minA,minB,slippage,expiresAt:pool.fetchedAt+60_000}
}
export function assertLiquidityReview(r: LiquidityReview) {
  if(Date.now()>=r.expiresAt)throw new SwapError('流动性报价已过期，请关闭并刷新。')
  const next=buildLiquidityReview(r.mode,r.a,r.b,r.account,r.pool,r.desiredA,r.desiredB,r.liquidity,r.slippage)
  if(next.amountA!==r.amountA || next.amountB!==r.amountB || next.minA!==r.minA || next.minB!==r.minB || next.liquidity!==r.liquidity || r.expiresAt!==next.expiresAt)throw new SwapError('流动性参数已变化，请重新确认。')
}
export function liquidityCall(r: LiquidityReview, deadline = BigInt(Math.floor(Date.now()/1000)+120)) {
  assertLiquidityReview(r)
  const base={address:ROUTER,abi:liquidityAbi,account:r.account,value:undefined}
  if(r.a.native || r.b.native) {
    const token=r.a.native?r.b:r.a, tokenAmount=r.a.native?r.amountB:r.amountA, nativeAmount=r.a.native?r.amountA:r.amountB
    const tokenMin=r.a.native?r.minB:r.minA,nativeMin=r.a.native?r.minA:r.minB
    return r.mode==='add'
      ? {...base,functionName:'addLiquidityETH' as const,args:[token.address,tokenAmount,tokenMin,nativeMin,r.account,deadline] as const,value:nativeAmount}
      : {...base,functionName:'removeLiquidityETH' as const,args:[token.address,r.liquidity,tokenMin,nativeMin,r.account,deadline] as const}
  }
  return r.mode==='add'
    ? {...base,functionName:'addLiquidity' as const,args:[r.a.address,r.b.address,r.amountA,r.amountB,r.minA,r.minB,r.account,deadline] as const}
    : {...base,functionName:'removeLiquidity' as const,args:[r.a.address,r.b.address,r.liquidity,r.minA,r.minB,r.account,deadline] as const}
}
export function liquidityApprovals(r: LiquidityReview) {
  return r.mode==='remove' ? [{address:r.pool.pair,amount:r.liquidity,symbol:'LP'}] : [{token:r.a,amount:r.amountA},{token:r.b,amount:r.amountB}].filter(x=>!x.token.native).map(x=>({address:x.token.address,amount:x.amount,symbol:x.token.symbol}))
}
async function ensureLiquidityWallet(client: PublicClient,wallet: WalletClient,r: LiquidityReview) {
  assertLiquidityReview(r)
  if(await client.getChainId()!==56 || await wallet.getChainId()!==56)throw new SwapError('请连接 BNB Smart Chain。')
  const [account]=await wallet.getAddresses()
  if(account?.toLowerCase()!==r.account.toLowerCase())throw new SwapError('钱包账户已改变，请重新确认。')
  const [factory,wrapped]=await Promise.all([client.readContract({address:ROUTER,abi:liquidityAbi,functionName:'factory'}),client.readContract({address:ROUTER,abi:liquidityAbi,functionName:'WETH'})])
  if(factory.toLowerCase()!==FACTORY.toLowerCase() || wrapped.toLowerCase()!==WBNB.toLowerCase())throw new SwapError('路由合约核验失败。')
  assertLiquidityReview(r)
}
export async function liquidityAllowance(client: PublicClient, r: LiquidityReview) {
  return Promise.all(liquidityApprovals(r).map(async item=>({...item,current:await client.readContract({address:item.address,abi:erc20Abi,functionName:'allowance',args:[r.account,ROUTER]})})))
}
export async function approveLiquidity(client: PublicClient,wallet: WalletClient,r: LiquidityReview) {
  await ensureLiquidityWallet(client,wallet,r)
  const required=(await liquidityAllowance(client,r)).find(a=>a.current<a.amount)
  if(!required)throw new SwapError('授权已足够，请刷新确认。')
  const {request}=await client.simulateContract({address:required.address,abi:erc20Abi,functionName:'approve',args:[ROUTER,required.current>0n?0n:required.amount],account:r.account})
  await ensureLiquidityWallet(client,wallet,r)
  return wallet.writeContract({...request,chain:bsc,account:r.account})
}
export async function executeLiquidity(client: PublicClient,wallet: WalletClient,r: LiquidityReview) {
  await ensureLiquidityWallet(client,wallet,r)
  if((await liquidityAllowance(client,r)).some(a=>a.current<a.amount))throw new SwapError('请先完成本次数量的授权。')
  if(r.mode==='add') {
    const balances=await Promise.all([readBalance(client,r.a,r.account),readBalance(client,r.b,r.account)])
    if(balances[0]<r.amountA || balances[1]<r.amountB)throw new SwapError('资产余额不足。')
  } else {
    const owned=await client.readContract({address:r.pool.pair,abi:erc20Abi,functionName:'balanceOf',args:[r.account]})
    if(owned<r.liquidity)throw new SwapError('LP 余额不足。')
  }
  const call=liquidityCall(r)
  switch(call.functionName){
    case 'addLiquidityETH': await client.simulateContract(call); break
    case 'removeLiquidityETH': await client.simulateContract(call); break
    case 'addLiquidity': await client.simulateContract(call); break
    case 'removeLiquidity': await client.simulateContract(call); break
  }
  const [gas,gasPrice,nativeBalance]=await Promise.all([client.estimateGas({account:r.account,to:call.address,data:encodeFunctionData(call),value:call.value,type:'legacy'}),client.getGasPrice(),client.getBalance({address:r.account})])
  if(nativeBalance<(call.value??0n)+gas*gasPrice*12n/10n)throw new SwapError('请预留足够的 BNB 支付网络费。')
  await ensureLiquidityWallet(client,wallet,r)
  switch(call.functionName){
    case 'addLiquidityETH': return wallet.writeContract({...call,chain:bsc,account:r.account})
    case 'removeLiquidityETH': return wallet.writeContract({...call,chain:bsc,account:r.account})
    case 'addLiquidity': return wallet.writeContract({...call,chain:bsc,account:r.account})
    case 'removeLiquidity': return wallet.writeContract({...call,chain:bsc,account:r.account})
  }
}
