import { parseAbi, type Address } from 'viem'
import stockTokens from './stock-tokens.json'

// PancakeSwap's published BSC V2 deployment; never supplied by a token or URL.
export const ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E' as const
export const FACTORY = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73' as const
export const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as const
export type SwapToken = { address: Address; symbol: string; name: string; decimals: number; native?: boolean; custom?: boolean; color: string; logoURI?: string; stockSymbol?: string; issuer?: string; source?: string; category?: string; verifiedAt?: string }
export const STOCK_TOKENS = stockTokens as SwapToken[]
export const TOKENS: SwapToken[] = [
  { address: WBNB, symbol: 'BNB', name: 'BNB · 原生资产', decimals: 18, native: true, color: '#f0b90b' },
  { address: '0x55d398326f99059fF775485246999027B3197955', symbol: 'USDT', name: 'Binance-Peg BSC-USD', decimals: 18, color: '#219b83' },
  { address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', symbol: 'CAKE', name: 'PancakeSwap', decimals: 18, color: '#28b8cc' },
  { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', symbol: 'USDC', name: 'Binance-Peg USD Coin', decimals: 18, color: '#2775ca' },
  { address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', symbol: 'BTCB', name: 'Binance-Peg Bitcoin', decimals: 18, color: '#f7931a' },
  { address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', symbol: 'ETH', name: 'Binance-Peg Ethereum', decimals: 18, color: '#627eea' },
  { address: WBNB, symbol: 'WBNB', name: 'Wrapped BNB', decimals: 18, color: '#c89b0a' },
  ...STOCK_TOKENS,
]
export const tokenKey = (t: SwapToken) => t.native ? 'BNB' : t.address.toLowerCase()
export const routerAbi = parseAbi([
  'function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)',
  'function swapExactETHForTokensSupportingFeeOnTransferTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) payable',
  'function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)',
  'function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)',
])
export const factoryAbi = parseAbi(['function getPair(address tokenA, address tokenB) view returns (address pair)'])
export const pairAbi = parseAbi(['function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)'])
export const wrappedAbi = parseAbi(['function deposit() payable', 'function withdraw(uint256 wad)'])
export const executionAbi = [...routerAbi, ...wrappedAbi] as const

export function swapHref(hostname = window.location.hostname) {
  if (/^(www\.)?gupiao\.sh$/.test(hostname)) return 'https://app.gupiao.sh/'
  if (/^(www\.)?hudiegupiao\.com$/.test(hostname)) return 'https://app.hudiegupiao.com/'
  return '/?view=swap'
}
export function homeHref(hostname = window.location.hostname) {
  if (hostname === 'app.gupiao.sh') return 'https://gupiao.sh/'
  if (hostname === 'app.hudiegupiao.com') return 'https://www.hudiegupiao.com/'
  return '/'
}

export function matchesToken(token: SwapToken, query: string) {
  return `${token.symbol} ${token.name} ${token.stockSymbol ?? ''} ${token.address}`.toLowerCase().includes(query.trim().toLowerCase())
}
export function selectedStockToken(search: string) {
  const address = new URLSearchParams(search).get('outputCurrency')?.toLowerCase()
  return STOCK_TOKENS.find(token => token.address.toLowerCase() === address)
}
export function stockSwapHref(token: SwapToken) {
  const href = swapHref()
  return `${href}${href.includes('?') ? '&' : '?'}outputCurrency=${token.address}`
}
