import { createPublicClient, encodeFunctionData, erc20Abi, fallback, formatUnits, getAddress, http, isAddress, parseUnits, zeroAddress, type Address, type Hash, type PublicClient, type WalletClient } from 'viem'
import { bsc } from 'viem/chains'
import { FACTORY, ROUTER, TOKENS, WBNB, executionAbi, factoryAbi, pairAbi, routerAbi, tokenKey, type SwapToken } from './config'

export const QUOTE_TTL = 30_000
export type SwapQuote = { input: SwapToken; output: SwapToken; amountIn: bigint; amountOut: bigint; path: Address[]; expiresAt: number; block: bigint; impactBps: number; wrap: boolean; alternatives?: { path: Address[]; amountOut: bigint }[]; checkedPaths?: number }
export type SwapReview = { quote: SwapQuote; account: Address; slippageBps: number; minimumOut: bigint }
export class SwapError extends Error {}
export const makeSwapClient = () => createPublicClient({ chain: bsc, transport: fallback([
  ...(typeof window !== 'undefined' && !['localhost', '127.0.0.1', 'terminal.local'].includes(window.location.hostname)
    ? [http('/api/swap-rpc', { timeout: 14000, retryCount: 0 })] : []),
  http('https://bsc-dataseed.bnbchain.org', { timeout: 6500, retryCount: 0 }),
  http('https://bsc-rpc.publicnode.com', { timeout: 6500, retryCount: 0 }),
], { retryCount: 0 }), batch: { multicall: true } })

export function parseAmount(value: string, decimals: number) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36 || value.length > 100 || !/^(?:\d+\.?\d*|\.\d+)$/.test(value)) throw new SwapError('请输入有效的兑换数量。')
  if ((value.split('.')[1]?.length ?? 0) > decimals) throw new SwapError(`该代币最多支持 ${decimals} 位小数。`)
  const amount = parseUnits(value, decimals)
  if (amount <= 0n || amount >= 2n ** 256n) throw new SwapError('兑换数量必须大于 0，且不能超出合约范围。')
  return amount
}
export function minimumReceived(amount: bigint, bps: number) {
  if (!Number.isInteger(bps) || bps < 10 || bps > 500) throw new SwapError('滑点请设置在 0.1% 到 5% 之间。')
  return amount * BigInt(10_000 - bps) / 10_000n
}
export function displayAmount(amount: bigint, decimals: number, digits = 6) {
  const value = formatUnits(amount, decimals)
  const [whole, fraction = ''] = value.split('.')
  if (amount > 0n && Number(value) < 10 ** -digits) return `<${(10 ** -digits).toFixed(digits)}`
  return whole + (fraction.slice(0, digits).replace(/0+$/, '') ? '.' + fraction.slice(0, digits).replace(/0+$/, '') : '')
}
export function candidatePaths(input: SwapToken, output: SwapToken): Address[][] {
  const a = input.address, b = output.address
  if (a.toLowerCase() === b.toLowerCase()) return [[a]]
  const bridges = [WBNB, TOKENS[1].address, TOKENS[3].address]
    .filter(address => ![a.toLowerCase(), b.toLowerCase()].includes(address.toLowerCase()))
  return [[a, b], ...bridges.map(bridge => [a, bridge, b]), ...bridges.flatMap(first => bridges.filter(second => second !== first).map(second => [a, first, second, b]))]
}
export async function importToken(client: PublicClient, address: string): Promise<SwapToken> {
  if (!isAddress(address) || address.toLowerCase() === zeroAddress) throw new SwapError('请输入有效的 BNB Chain 合约地址。')
  const known = TOKENS.find(t => !t.native && t.address.toLowerCase() === address.toLowerCase())
  if (known) return known
  const checked = getAddress(address)
  const [symbol, name, decimals] = await Promise.all([
    client.readContract({ address: checked, abi: erc20Abi, functionName: 'symbol' }),
    client.readContract({ address: checked, abi: erc20Abi, functionName: 'name' }),
    client.readContract({ address: checked, abi: erc20Abi, functionName: 'decimals' }),
  ])
  if (decimals > 36 || !symbol || symbol.length > 30 || name.length > 120) throw new SwapError('暂不支持此代币的元数据格式。')
  return { address: checked, symbol, name, decimals, custom: true, color: '#6a38ea' }
}
export async function readBalance(client: PublicClient, token: SwapToken, account: Address) {
  return token.native ? client.getBalance({ address: account }) : client.readContract({ address: token.address, abi: erc20Abi, functionName: 'balanceOf', args: [account] })
}
export async function getQuote(client: PublicClient, input: SwapToken, output: SwapToken, amountIn: bigint): Promise<SwapQuote> {
  if (amountIn <= 0n || tokenKey(input) === tokenKey(output)) throw new SwapError('请选择不同的资产，并输入大于 0 的数量。')
  if (await client.getChainId() !== 56) throw new SwapError('行情节点网络不匹配，请重试。')
  const block = await client.getBlockNumber()
  const wrap = input.address.toLowerCase() === output.address.toLowerCase()
  if (wrap) return { input, output, amountIn, amountOut: amountIn, path: [WBNB], expiresAt: Date.now() + QUOTE_TTL, block, impactBps: 0, wrap }
  const paths = candidatePaths(input, output)
  const results = await Promise.allSettled(paths.map(async path => {
    const amounts = await client.readContract({ address: ROUTER, abi: routerAbi, functionName: 'getAmountsOut', args: [amountIn, path], blockNumber: block })
    return { path, amountOut: amounts[amounts.length - 1] }
  }))
  const routes = results.flatMap(r => r.status === 'fulfilled' && r.value.amountOut > 0n ? [r.value] : []).sort((a, b) => a.amountOut === b.amountOut ? a.path.length - b.path.length : a.amountOut > b.amountOut ? -1 : 1)
  if (!routes.length) throw new SwapError('暂未找到可用的 PancakeSwap V2 路径，或节点连接失败。请重试；仅有 V3 / Infinity 池的代币暂不支持。')
  const best = routes[0]
  // Compare quoted output with marginal reserve pricing, including the same V2 pool fee.
  let marginal = amountIn
  for (let i = 0; i < best.path.length - 1; i++) {
    const a = best.path[i], b = best.path[i + 1]
    const pair = await client.readContract({ address: FACTORY, abi: factoryAbi, functionName: 'getPair', args: [a, b], blockNumber: block })
    const [r0, r1] = await client.readContract({ address: pair, abi: pairAbi, functionName: 'getReserves', blockNumber: block })
    const [reserveIn, reserveOut] = a.toLowerCase() < b.toLowerCase() ? [r0, r1] : [r1, r0]
    if (!reserveIn || !reserveOut) throw new SwapError('池子流动性不足，请更换代币或稍后重试。')
    marginal = marginal * reserveOut * 9975n / (reserveIn * 10000n)
  }
  const impactBps = marginal > best.amountOut ? Number((marginal - best.amountOut) * 10000n / marginal) : 0
  return { input, output, amountIn, ...best, block, impactBps, wrap, alternatives: routes, checkedPaths: paths.length, expiresAt: Date.now() + QUOTE_TTL }
}
export function assertReview(review: SwapReview, now = Date.now()) {
  if (now >= review.quote.expiresAt) throw new SwapError('报价已过期，请关闭确认窗口并刷新报价。')
  if (review.quote.impactBps >= 1000) throw new SwapError('价格影响达到 10%，已暂停此次兑换。请减少数量。')
  const expected = review.quote.wrap ? review.quote.amountOut : minimumReceived(review.quote.amountOut, review.slippageBps)
  if (review.minimumOut !== expected || expected <= 0n) throw new SwapError('最低到账数量无效，请重新获取报价。')
}
async function ensureWallet(wallet: WalletClient, expected: Address) {
  if (await wallet.getChainId() !== 56) await wallet.switchChain({ id: 56 })
  if (await wallet.getChainId() !== 56) throw new SwapError('请在钱包切换到 BNB Smart Chain。')
  const [account] = await wallet.getAddresses()
  if (!account || account.toLowerCase() !== expected.toLowerCase()) throw new SwapError('钱包账户已改变，请重新连接并确认兑换。')
  return account
}
export async function getAllowance(client: PublicClient, quote: SwapQuote, account: Address) {
  if (quote.input.native || quote.wrap) return quote.amountIn
  return client.readContract({ address: quote.input.address, abi: erc20Abi, functionName: 'allowance', args: [account, ROUTER] })
}
export async function approveExact(client: PublicClient, wallet: WalletClient, review: SwapReview): Promise<Hash> {
  assertReview(review)
  const account = await ensureWallet(wallet, review.account)
  assertReview(review)
  if (review.quote.input.native || review.quote.wrap) throw new SwapError('此交易不需要授权。')
  const current = await getAllowance(client, review.quote, account)
  if (current >= review.quote.amountIn) throw new SwapError('授权已足够，请刷新后确认兑换。')
  // Tokens that require zero-first approvals receive a separate explicit reset action.
  const value = current > 0n ? 0n : review.quote.amountIn
  const { request } = await client.simulateContract({ address: review.quote.input.address, abi: erc20Abi, functionName: 'approve', args: [ROUTER, value], account })
  await ensureWallet(wallet, account)
  assertReview(review)
  return wallet.writeContract({ ...request, chain: bsc, account })
}
export function swapCall(review: SwapReview) {
  const q = review.quote
  const account = review.account
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 120)
  if (q.wrap) return q.input.native
    ? { address: WBNB, abi: executionAbi, functionName: 'deposit' as const, account, value: q.amountIn }
    : { address: WBNB, abi: executionAbi, functionName: 'withdraw' as const, args: [q.amountIn] as const, account }
  const common = { address: ROUTER, abi: executionAbi, account }
  if (q.input.native) return { ...common, functionName: 'swapExactETHForTokensSupportingFeeOnTransferTokens' as const, args: [review.minimumOut, q.path, account, deadline] as const, value: q.amountIn }
  if (q.output.native) return { ...common, functionName: 'swapExactTokensForETHSupportingFeeOnTransferTokens' as const, args: [q.amountIn, review.minimumOut, q.path, account, deadline] as const }
  return { ...common, functionName: 'swapExactTokensForTokensSupportingFeeOnTransferTokens' as const, args: [q.amountIn, review.minimumOut, q.path, account, deadline] as const }
}
export async function executeSwap(client: PublicClient, wallet: WalletClient, review: SwapReview): Promise<Hash> {
  assertReview(review)
  const account = await ensureWallet(wallet, review.account)
  assertReview(review)
  const q = review.quote
  const [balance, allowance, nativeBalance] = await Promise.all([readBalance(client, q.input, account), getAllowance(client, q, account), client.getBalance({ address: account })])
  if (balance < q.amountIn) throw new SwapError('可用余额不足，请调整兑换数量。')
  if (allowance < q.amountIn) throw new SwapError('请先授权本次需要的代币数量。')
  const call = swapCall(review)
  // Simulation checks the real recipient, minOut, tax handling, balance and allowances.
  await client.simulateContract(call)
  const gas = await client.estimateGas({ account, to: call.address, data: encodeFunctionData(call), value: call.value, type: 'legacy' })
  const gasPrice = await client.getGasPrice()
  if (nativeBalance < (q.input.native ? q.amountIn : 0n) + gas * gasPrice * 12n / 10n) throw new SwapError('请保留足够的 BNB 支付网络费。')
  await ensureWallet(wallet, account)
  assertReview(review)
  return wallet.writeContract({ ...call, account, chain: bsc })
}
export function friendlySwapError(error: unknown) {
  if (error instanceof SwapError) return error.message
  const raw = String((error as { shortMessage?: string })?.shortMessage ?? (error as Error)?.message ?? '')
  if (/reject|denied|4001/i.test(raw)) return '已取消钱包操作，未提交新的交易。'
  if (/insufficient funds/i.test(raw)) return 'BNB 或代币余额不足，请检查数量和网络费。'
  if (/revert|transfer|allowance/i.test(raw)) return '交易模拟未通过。请检查余额、授权和代币税费，或减少数量后重新报价。'
  return '暂时无法完成操作，请检查网络后重试。'
}
