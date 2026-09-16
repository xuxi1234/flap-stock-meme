import { getAddress, isAddress, keccak256, parseAbi, zeroAddress, type Address, type PublicClient } from 'viem'
import deployment from './swap-deployment.json'
import { ROUTER, WBNB } from './config'
import { V3_ROUTER, encodeV3Path } from './v3'
import type { SwapQuote, SwapReview } from './service'

export const TREASURY = getAddress('0x133c7e613a62dc43876f17b688df0b4d24a75735')
export const FEE_BPS = 80n
export const feeAbi = parseAbi([
  'function swapV2(uint256 amountIn,uint256 minimumNet,address[] path,bool nativeIn,bool nativeOut,address inviter,uint256 deadline) payable returns (uint256)',
  'function swapV3(uint256 amountIn,uint256 minimumNet,bytes path,bool nativeIn,bool nativeOut,address inviter,uint256 deadline) payable returns (uint256)',
  'function treasury() view returns (address)', 'function feeBps() view returns (uint256)', 'function inviterPercent() view returns (uint256)',
  'function v2Router() view returns (address)', 'function v3Router() view returns (address)', 'function wrappedNative() view returns (address)',
  'function referrerOf(address) view returns (address)', 'function invitedCount(address) view returns (uint256)',
  'function earned(address,address) view returns (uint256)',
])
export function feeDeployment(): Address | null {
  const d = deployment as {chainId:number;address:string|null;runtimeCodeHash:string|null}
  return d.chainId === 56 && d.address && isAddress(d.address) && d.address !== zeroAddress && /^0x[0-9a-fA-F]{64}$/.test(d.runtimeCodeHash ?? '') ? getAddress(d.address) : null
}
export function splitFee(gross: bigint, referred: boolean) {
  if (gross < 0n || gross >= 2n ** 256n) throw Error('Invalid fee amount')
  const fee = gross * FEE_BPS / 10000n
  const inviter = referred ? fee * 70n / 100n : 0n
  return {fee, inviter, treasury: fee - inviter, net: gross - fee}
}
export function parseReferrer(search: string, account?: Address | null): Address | null {
  const params = new URLSearchParams(search)
  const values = [...params.getAll('ref'), ...params.getAll('p')]
  if (values.length !== 1 || !isAddress(values[0])) return null
  const a = getAddress(values[0])
  if ([zeroAddress, TREASURY, feeDeployment(), account].some(x => x?.toLowerCase() === a.toLowerCase())) return null
  return a
}
export function referralLink(origin: string, account: Address) {
  const url = new URL('/', origin)
  url.searchParams.set('view', 'swap')
  url.searchParams.set('ref', getAddress(account))
  return url.href
}
export function withPlatformFee(quote: SwapQuote): SwapQuote {
  if (quote.wrap || quote.platformFee) return quote
  const gross = quote.amountOut, {fee, net} = splitFee(gross, false)
  return {...quote, amountOut:net, platformFee:{gross, fee}, alternatives:quote.alternatives?.map(r=>({...r,amountOut:splitFee(r.amountOut,false).net}))}
}
export async function verifyFeeDeployment(client: PublicClient): Promise<Address> {
  const address = feeDeployment()
  if (!address) throw Error('收费版本尚未开放交易，请先查看报价。')
  const code = await client.getCode({address})
  if (await client.getChainId() !== 56 || !code || keccak256(code) !== deployment.runtimeCodeHash) throw Error('收费合约校验失败。')
  const [treasury, fee, share, v2, v3, wrapped] = await Promise.all([
    client.readContract({address,abi:feeAbi,functionName:'treasury'}), client.readContract({address,abi:feeAbi,functionName:'feeBps'}),
    client.readContract({address,abi:feeAbi,functionName:'inviterPercent'}), client.readContract({address,abi:feeAbi,functionName:'v2Router'}),
    client.readContract({address,abi:feeAbi,functionName:'v3Router'}), client.readContract({address,abi:feeAbi,functionName:'wrappedNative'}),
  ])
  if (treasury.toLowerCase() !== TREASURY.toLowerCase() || fee !== FEE_BPS || share !== 70n || v2.toLowerCase() !== ROUTER.toLowerCase() || v3.toLowerCase() !== V3_ROUTER.toLowerCase() || wrapped.toLowerCase() !== WBNB.toLowerCase()) throw Error('收费参数校验失败。')
  return address
}
export async function resolveReferrer(client: PublicClient, account: Address, candidate: Address | null) {
  const address = await verifyFeeDeployment(client)
  const bound = await client.readContract({address,abi:feeAbi,functionName:'referrerOf',args:[account]})
  return bound !== zeroAddress ? bound : parseReferrer(candidate ? `?ref=${candidate}` : '', account)
}
export function feeSwapCall(review: SwapReview, deadline: bigint) {
  const address = feeDeployment()
  if (!address) throw Error('收费版本尚未开放交易，请先查看报价。')
  const q = review.quote
  const common = {address, abi:feeAbi, account:review.account, value:q.input.native ? q.amountIn : undefined}
  const tail = [!!q.input.native, !!q.output.native, review.referrer ?? zeroAddress, deadline] as const
  if (q.protocol === 'V3') return {...common, functionName:'swapV3' as const, args:[q.amountIn,review.minimumOut,encodeV3Path(q.path,q.fees ?? []),...tail] as const}
  return {...common, functionName:'swapV2' as const, args:[q.amountIn,review.minimumOut,q.path,...tail] as const}
}
