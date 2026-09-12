import { OWNER, ZERO, type LaunchInput } from './protocol'

// Public metadata uploaded successfully via the deployed endpoint on 2026-09-12.
// This creates a separate acceptance token; it is not the presale token.
export const acceptanceInput: LaunchInput = {
  name:'Butterfly Vault Check', symbol:'FLAPCHK',
  meta:'bafkreihoo25ud3y4yt5mr3zlddtdclt4v3mxibc3kmhznxz5dkid3ube4u',
  quoteToken:ZERO,buyPct:'3',sellPct:'3',taxDays:'36500',protectionDays:'30',
  mktPct:'100',burnPct:'0',dividendPct:'0',lpPct:'0',minimumHold:'0',dividendToken:ZERO,
}
export const acceptanceAccount = OWNER
export const acceptanceMaxCost = 2_000_000_000_000_000n // 0.002 BNB; excludes any purchase (always zero)
