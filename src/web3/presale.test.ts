import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Address, PublicClient, WalletClient } from 'viem'
import { participate, readPresaleState, waitForParticipationReceipt } from './presale'

const contract = '0x1111111111111111111111111111111111111111' as Address
const account = '0x2222222222222222222222222222222222222222' as Address

beforeEach(() => { vi.spyOn(Date, 'now').mockReturnValue(1_788_904_799_000) })
afterEach(() => { vi.restoreAllMocks() })

describe('presale web3 boundary', () => {
  it('reads the live sale state and the connected address participation flag', async () => {
    const values = {
      participantCount: 9_999n,
      endTime: 1_788_969_599n,
      paused: false,
      hasParticipated: true,
    }
    const readContract = vi.fn(async ({ functionName }: { functionName: keyof typeof values }) => values[functionName])

    const state = await readPresaleState({ readContract } as unknown as PublicClient, contract, account)

    expect(state).toEqual({ ...values, soldOut: false })
    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'hasParticipated', args: [account] }))
  })

  it('marks the presale sold out at its 10,000-address capacity', async () => {
    const readContract = vi.fn(async ({ functionName }: { functionName: string }) => ({
      participantCount: 10_000n,
      endTime: 1_788_969_599n,
      paused: false,
    })[functionName])

    const state = await readPresaleState({ readContract } as unknown as PublicClient, contract)

    expect(state.soldOut).toBe(true)
    expect(state.hasParticipated).toBe(false)
  })

  it('surfaces an RPC read rejection', async () => {
    const failure = new Error('RPC unavailable')
    const readContract = vi.fn().mockRejectedValue(failure)

    await expect(readPresaleState({ readContract } as unknown as PublicClient, contract)).rejects.toBe(failure)
  })

  it('switches to BSC mainnet and writes exactly 0.05 BNB', async () => {
    const switchChain = vi.fn().mockResolvedValue(undefined)
    const writeContract = vi.fn().mockResolvedValue('0xabc')
    const wallet = {
      getAddresses: vi.fn().mockResolvedValue([account]),
      requestAddresses: vi.fn(),
      getChainId: vi.fn().mockResolvedValue(1),
      switchChain,
      writeContract,
    } as unknown as WalletClient

    await expect(participate(wallet, contract)).resolves.toBe('0xabc')

    expect(switchChain).toHaveBeenCalledWith({ id: 56 })
    expect(writeContract).toHaveBeenCalledWith(expect.objectContaining({
      account,
      address: contract,
      chain: expect.objectContaining({ id: 56 }),
      functionName: 'participate',
      value: 50_000_000_000_000_000n,
    }))
  })

  it('requests wallet access when no account is already exposed', async () => {
    const requestAddresses = vi.fn().mockResolvedValue([account])
    const writeContract = vi.fn().mockResolvedValue('0xdef')
    const wallet = {
      getAddresses: vi.fn().mockResolvedValue([]),
      requestAddresses,
      getChainId: vi.fn().mockResolvedValue(56),
      switchChain: vi.fn(),
      writeContract,
    } as unknown as WalletClient

    await participate(wallet, contract)

    expect(requestAddresses).toHaveBeenCalledTimes(1)
    expect(writeContract).toHaveBeenCalledTimes(1)
  })

  it('rejects a null contract before asking the wallet for an account or sending', async () => {
    const getAddresses = vi.fn()
    const writeContract = vi.fn()
    const wallet = { getAddresses, writeContract } as unknown as WalletClient

    await expect(participate(wallet, null)).rejects.toThrow('Presale contract is unavailable')

    expect(getAddresses).not.toHaveBeenCalled()
    expect(writeContract).not.toHaveBeenCalled()
  })

  it('surfaces a rejected transaction without retrying the write', async () => {
    const rejection = new Error('User rejected the request')
    const writeContract = vi.fn().mockRejectedValue(rejection)
    const wallet = {
      getAddresses: vi.fn().mockResolvedValue([account]),
      requestAddresses: vi.fn(),
      getChainId: vi.fn().mockResolvedValue(56),
      switchChain: vi.fn(),
      writeContract,
    } as unknown as WalletClient

    await expect(participate(wallet, contract)).rejects.toBe(rejection)
    expect(writeContract).toHaveBeenCalledTimes(1)
  })

  it('rejects before writing when the wallet account no longer matches the validated account', async () => {
    const changedAccount = '0x3333333333333333333333333333333333333333' as Address
    const writeContract = vi.fn()
    const wallet = {
      getAddresses: vi.fn().mockResolvedValue([changedAccount]),
      requestAddresses: vi.fn(),
      getChainId: vi.fn().mockResolvedValue(56),
      switchChain: vi.fn(),
      writeContract,
    } as unknown as WalletClient

    await expect(participate(wallet, contract, account)).rejects.toThrow('Wallet account changed; reconnect required')
    expect(writeContract).not.toHaveBeenCalled()
  })

  it('rejects a cancelled replacement even when its receipt succeeded', async () => {
    const replacementHash = '0xcancelled'
    const waitForTransactionReceipt = vi.fn(async ({ onReplaced }: { onReplaced?: (replacement: unknown) => void }) => {
      const transactionReceipt = { status: 'success', transactionHash: replacementHash }
      onReplaced?.({
        reason: 'cancelled',
        replacedTransaction: { hash: '0xabc' },
        transaction: { hash: replacementHash, input: '0x', to: account, value: 0n },
        transactionReceipt,
      })
      return transactionReceipt
    })

    await expect(waitForParticipationReceipt({ waitForTransactionReceipt } as unknown as PublicClient, contract, '0xabc')).rejects.toThrow('Transaction cancelled; participation was not recorded')
  })

  it('rejects a replacement that is no longer the fixed-value presale call', async () => {
    const replacementHash = '0xreplaced'
    const waitForTransactionReceipt = vi.fn(async ({ onReplaced }: { onReplaced?: (replacement: unknown) => void }) => {
      const transactionReceipt = { status: 'success', transactionHash: replacementHash }
      onReplaced?.({
        reason: 'replaced',
        replacedTransaction: { hash: '0xabc' },
        transaction: { hash: replacementHash, input: '0x12345678', to: account, value: 1n },
        transactionReceipt,
      })
      return transactionReceipt
    })

    await expect(waitForParticipationReceipt({ waitForTransactionReceipt } as unknown as PublicClient, contract, '0xabc')).rejects.toThrow('Transaction replaced with a different call; participation was not recorded')
  })

  it('accepts a repriced presale call and returns its final confirmed hash', async () => {
    const replacementHash = '0xrepriced'
    const waitForTransactionReceipt = vi.fn(async ({ onReplaced }: { onReplaced?: (replacement: unknown) => void }) => {
      const transactionReceipt = { status: 'success', transactionHash: replacementHash }
      onReplaced?.({
        reason: 'repriced',
        replacedTransaction: { hash: '0xabc' },
        transaction: {
          hash: replacementHash,
          input: '0xd11711a2',
          to: contract,
          value: 50_000_000_000_000_000n,
        },
        transactionReceipt,
      })
      return transactionReceipt
    })

    await expect(waitForParticipationReceipt({ waitForTransactionReceipt } as unknown as PublicClient, contract, '0xabc')).resolves.toBe(replacementHash)
    expect(waitForTransactionReceipt).toHaveBeenCalledWith(expect.objectContaining({ hash: '0xabc', onReplaced: expect.any(Function) }))
  })
})
