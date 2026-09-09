import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WalletClient } from 'viem'
import { projectConfig } from '../config/project'
import { effectivePresaleDeadline, presaleDeadlineReached } from './presaleDeadline'
import { participate } from './presale'

const cutoff = 1_789_142_400
afterEach(() => vi.restoreAllMocks())

describe('private sale cutoff', () => {
  it('maps the end of September 11 Beijing to September 11 16:00 UTC', () => {
    expect(Date.parse('2026-09-12T00:00:00+08:00') / 1000).toBe(cutoff)
    expect(Date.parse(projectConfig.presale.deadlineUtc) / 1000).toBe(cutoff)
    expect(projectConfig.presale.websiteDeadline).toBe(cutoff)
  })
  it('always applies the earlier of website and on-chain deadlines', () => {
    expect(effectivePresaleDeadline(BigInt(cutoff + 10))).toBe(BigInt(cutoff))
    expect(effectivePresaleDeadline(BigInt(cutoff - 10))).toBe(BigInt(cutoff - 10))
  })
  it('keeps the original contract deadline until the owner extends it', () => {
    expect(effectivePresaleDeadline(1_788_969_599n)).toBe(1_788_969_599n)
    expect(presaleDeadlineReached(1_788_969_599n, 1_788_969_599_000)).toBe(true)
    expect(presaleDeadlineReached(BigInt(cutoff), 1_788_969_599_000)).toBe(false)
  })
  it('closes exactly at the deadline, including when chain reads fail', () => {
    expect(presaleDeadlineReached(undefined, cutoff * 1000 - 1)).toBe(false)
    expect(presaleDeadlineReached(undefined, cutoff * 1000)).toBe(true)
    expect(presaleDeadlineReached(1_788_969_599n, cutoff * 1000 + 1)).toBe(true)
  })
  it('does not request accounts or write after the website deadline', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(cutoff * 1000)
    const getAddresses = vi.fn()
    const writeContract = vi.fn()
    await expect(participate({ getAddresses, writeContract } as unknown as WalletClient, projectConfig.presale.contractAddress)).rejects.toThrow('deadline reached')
    expect(getAddresses).not.toHaveBeenCalled()
    expect(writeContract).not.toHaveBeenCalled()
  })
  it('blocks the write if network switching crosses the deadline', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(cutoff * 1000 - 1000)
    const writeContract = vi.fn()
    const wallet = {
      getAddresses: vi.fn().mockResolvedValue([projectConfig.presale.adminAddress]),
      getChainId: vi.fn().mockResolvedValue(1),
      switchChain: vi.fn(async () => { now.mockReturnValue(cutoff * 1000) }),
      writeContract,
    } as unknown as WalletClient
    await expect(participate(wallet, projectConfig.presale.contractAddress)).rejects.toThrow('deadline reached')
    expect(writeContract).not.toHaveBeenCalled()
  })
})
