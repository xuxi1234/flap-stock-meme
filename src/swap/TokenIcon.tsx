import { useEffect, useState } from 'react'
import type { SwapToken } from './config'
export function TokenIcon({ token }: { token: SwapToken }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [token.logoURI])
  if (token.logoURI && !failed) return <span className="swap-token-icon swap-token-image"><img src={token.logoURI} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} /></span>
  return <span className="swap-token-icon" style={{ background: token.color }} aria-hidden="true">{({ BNB: '◆', WBNB: '◆', USDT: '₮', USDC: '$', BTCB: '₿', ETH: 'Ξ', CAKE: '◒' } as Record<string, string>)[token.symbol] ?? token.symbol.slice(0, 1)}</span>
}
