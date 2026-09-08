import { projectConfig } from '../config/project'

// The website can close earlier; it must never extend the contract's deadline.
export function effectivePresaleDeadline(chainEndTime?: bigint): bigint {
  const websiteEndTime = BigInt(projectConfig.presale.websiteDeadline)
  return chainEndTime !== undefined && chainEndTime < websiteEndTime ? chainEndTime : websiteEndTime
}

export function presaleDeadlineReached(chainEndTime: bigint | undefined, nowMs: number): boolean {
  return BigInt(Math.floor(nowMs / 1_000)) >= effectivePresaleDeadline(chainEndTime)
}
