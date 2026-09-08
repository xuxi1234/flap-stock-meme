import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WalletClient } from 'viem'
import { projectConfig } from '../config/project'
import { effectivePresaleDeadline, presaleDeadlineReached } from './presaleDeadline'
import { participate } from './presale'

const cutoff = 1_788_908_399
afterEach(() => vi.restoreAllMocks())

describe('private sale cutoff', () => {
  it('maps 06:59:59 Beijing to 22:59:59 UTC on the previous day', () => {
    expect(Date.parse('2026-09-09T06:59:59+08:00') / 1000).toBe(cutoff)
    expect(Date.parse(projectConfig.presale.deadlineUtc) / 1000).toBe(cutoff)
    expect(projectConfig.presale.websiteDeadline).toBe(cutoff)
  })
  it('always applies the earlier of website and on-chain deadlines', () => {
    expect(effectivePresaleDeadline(1_788_969_599n)).toBe(BigInt(cutoff))
    expect(effectivePresaleDeadline(BigInt(cutoff - 10))).toBe(BigInt(cutoff - 10))
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
