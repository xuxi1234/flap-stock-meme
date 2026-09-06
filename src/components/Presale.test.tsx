import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Address, EIP1193Provider, PublicClient, WalletClient } from 'viem'
import { siteContent } from '../content/siteContent'
import { Presale } from './Presale'

const contract = '0x1111111111111111111111111111111111111111' as Address
const account = '0x2222222222222222222222222222222222222222' as Address
const changedAccount = '0x3333333333333333333333333333333333333333' as Address
const frozenNow = 1_788_965_999_000

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(frozenNow)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function eventProvider() {
  const listeners = new Map<string, Set<(value: unknown) => void>>()
  return {
    request: vi.fn(),
    on: vi.fn((event: string, listener: (value: unknown) => void) => {
      const handlers = listeners.get(event) ?? new Set()
      handlers.add(listener)
      listeners.set(event, handlers)
    }),
    removeListener: vi.fn((event: string, listener: (value: unknown) => void) => listeners.get(event)?.delete(listener)),
    emit(event: string, value: unknown) {
      listeners.get(event)?.forEach((listener) => listener(value))
    },
  }
}

function clients(overrides: {
  count?: bigint
  endTime?: bigint
  paused?: boolean
  participated?: boolean
  chainId?: number
  writeError?: Error
  state?: () => { count?: bigint; endTime?: bigint; paused?: boolean; participated?: boolean }
  waitForTransactionReceipt?: ReturnType<typeof vi.fn>
} = {}) {
  const readContract = vi.fn(async ({ functionName }: { functionName: string }) => ({
    participantCount: overrides.state?.().count ?? overrides.count ?? 18n,
    endTime: overrides.state?.().endTime ?? overrides.endTime ?? 1_788_969_599n,
    paused: overrides.state?.().paused ?? overrides.paused ?? false,
    hasParticipated: overrides.state?.().participated ?? overrides.participated ?? false,
  })[functionName])
  const writeContract = overrides.writeError
    ? vi.fn().mockRejectedValue(overrides.writeError)
    : vi.fn().mockResolvedValue('0xabc')
  const waitForTransactionReceipt = overrides.waitForTransactionReceipt
    ?? vi.fn().mockResolvedValue({ status: 'success', transactionHash: '0xabc' })
  const walletClient = {
    requestAddresses: vi.fn().mockResolvedValue([account]),
    getAddresses: vi.fn().mockResolvedValue([account]),
    getChainId: vi.fn().mockResolvedValue(overrides.chainId ?? 56),
    switchChain: vi.fn().mockResolvedValue(undefined),
    writeContract,
  } as unknown as WalletClient

  return {
    publicClient: { readContract, waitForTransactionReceipt } as unknown as PublicClient,
    walletClient,
    readContract,
    waitForTransactionReceipt,
    writeContract,
  }
}

describe('Presale interaction inside the approved console', () => {
  it('keeps a null contract disabled and never reaches a read or wallet transaction', () => {
    const setup = clients()

    render(<Presale copy={siteContent.zh.presale} contractAddress={null} publicClient={setup.publicClient} walletClient={setup.walletClient} />)

    expect(screen.getByRole('region', { name: '预售控制台' })).toHaveClass('presale-section')
    expect(screen.getByRole('button', { name: '预售尚未开放' })).toBeDisabled()
    expect(setup.readContract).not.toHaveBeenCalled()
    expect(setup.writeContract).not.toHaveBeenCalled()
  })

  it('shows the live countdown and requires all risk disclosures before confirmation', async () => {
    const setup = clients()
    render(
      <Presale
        copy={siteContent.en.presale}
        contractAddress={contract}
        publicClient={setup.publicClient}
        walletClient={setup.walletClient}
      />,
    )

    expect(await screen.findByText('COUNTDOWN: 01:00:00')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'CONNECT BSC WALLET' }))

    const disclosure = await screen.findByRole('checkbox', { name: /manual FLAP distribution.*no refunds.*one-address-once does not mean one-person-once/i })
    const confirm = screen.getByRole('button', { name: 'CONFIRM 0.05 BNB PARTICIPATION' })
    expect(confirm).toBeDisabled()

    fireEvent.click(disclosure)
    expect(confirm).toBeEnabled()
  })

  it('blocks an address that already participated', async () => {
    const setup = clients({ participated: true })
    render(<Presale copy={siteContent.en.presale} contractAddress={contract} publicClient={setup.publicClient} walletClient={setup.walletClient} />)

    fireEvent.click(await screen.findByRole('button', { name: 'CONNECT BSC WALLET' }))

    expect(await screen.findByText('THIS ADDRESS ALREADY PARTICIPATED')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ALREADY PARTICIPATED' })).toBeDisabled()
    expect(setup.writeContract).not.toHaveBeenCalled()
  })

  it('blocks a sold-out presale at 10,000 participants', async () => {
    const setup = clients({ count: 10_000n })
    render(<Presale copy={siteContent.en.presale} contractAddress={contract} publicClient={setup.publicClient} walletClient={setup.walletClient} />)

    expect(await screen.findByText('PRESALE SOLD OUT')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'SOLD OUT' })).toBeDisabled()
    expect(setup.writeContract).not.toHaveBeenCalled()
  })

  it('blocks participation and reports an RPC rejection', async () => {
    const failure = new Error('RPC unavailable')
    const readContract = vi.fn().mockRejectedValue(failure)
    const setup = clients()
    render(
      <Presale
        copy={siteContent.en.presale}
        contractAddress={contract}
        publicClient={{ readContract } as unknown as PublicClient}
        walletClient={setup.walletClient}
      />,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('PRESALE DATA UNAVAILABLE: RPC unavailable')
    expect(screen.getByRole('button', { name: 'PRESALE UNAVAILABLE' })).toBeDisabled()
    expect(setup.writeContract).not.toHaveBeenCalled()
  })

  it('reports a rejected wallet transaction without showing success', async () => {
    const setup = clients({ writeError: new Error('User rejected the request') })
    render(<Presale copy={siteContent.en.presale} contractAddress={contract} publicClient={setup.publicClient} walletClient={setup.walletClient} />)

    fireEvent.click(await screen.findByRole('button', { name: 'CONNECT BSC WALLET' }))
    fireEvent.click(await screen.findByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'CONFIRM 0.05 BNB PARTICIPATION' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('TRANSACTION NOT SENT: User rejected the request'))
    expect(screen.queryByText(/TRANSACTION SUBMITTED/)).not.toBeInTheDocument()
    expect(setup.writeContract).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'CONFIRM 0.05 BNB PARTICIPATION' })).toBeEnabled()
  })

  it('resets confirmation, changes the validated account, and disconnects on wallet account events', async () => {
    const provider = eventProvider()
    const setup = clients()
    render(
      <Presale
        copy={siteContent.en.presale}
        contractAddress={contract}
        provider={provider as unknown as EIP1193Provider}
        publicClient={setup.publicClient}
        walletClient={setup.walletClient}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'CONNECT BSC WALLET' }))
    fireEvent.click(await screen.findByRole('checkbox'))
    expect(screen.getByRole('checkbox')).toBeChecked()

    act(() => provider.emit('accountsChanged', [changedAccount]))

    expect(await screen.findByRole('checkbox')).not.toBeChecked()
    expect(setup.readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'hasParticipated', args: [changedAccount] }))

    act(() => provider.emit('accountsChanged', []))

    expect(await screen.findByRole('button', { name: 'CONNECT BSC WALLET' })).toBeEnabled()
  })

  it('resets confirmation and updates network guidance on chain changes', async () => {
    const provider = eventProvider()
    const setup = clients()
    render(
      <Presale
        copy={siteContent.en.presale}
        contractAddress={contract}
        provider={provider as unknown as EIP1193Provider}
        publicClient={setup.publicClient}
        walletClient={setup.walletClient}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'CONNECT BSC WALLET' }))
    fireEvent.click(await screen.findByRole('checkbox'))
    act(() => provider.emit('chainChanged', '0x1'))

    expect(await screen.findByText('SWITCH REQUIRED: BSC MAINNET (56)')).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  it('waits for a successful receipt and a fresh state read before showing success', async () => {
    let resolveReceipt!: (receipt: { status: 'success'; transactionHash: Address }) => void
    let mined = false
    const receipt = new Promise<{ status: 'success'; transactionHash: Address }>((resolve) => {
      resolveReceipt = resolve
    })
    const waitForTransactionReceipt = vi.fn(() => receipt)
    const setup = clients({ state: () => ({ participated: mined }), waitForTransactionReceipt })
    render(<Presale copy={siteContent.en.presale} contractAddress={contract} publicClient={setup.publicClient} walletClient={setup.walletClient} />)

    fireEvent.click(await screen.findByRole('button', { name: 'CONNECT BSC WALLET' }))
    fireEvent.click(await screen.findByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'CONFIRM 0.05 BNB PARTICIPATION' }))

    await waitFor(() => expect(waitForTransactionReceipt).toHaveBeenCalledWith(expect.objectContaining({ hash: '0xabc', onReplaced: expect.any(Function) })))
    expect(screen.queryByText(/TRANSACTION SUBMITTED/)).not.toBeInTheDocument()
    expect(screen.queryByText('THIS ADDRESS ALREADY PARTICIPATED')).not.toBeInTheDocument()

    mined = true
    resolveReceipt({ status: 'success', transactionHash: '0xabc' })

    expect(await screen.findByText(/TRANSACTION SUBMITTED: 0xabc/)).toBeInTheDocument()
    expect(screen.getByText('THIS ADDRESS ALREADY PARTICIPATED')).toBeInTheDocument()
  })

  it('treats a failed receipt as retryable and never marks the address as participated', async () => {
    const waitForTransactionReceipt = vi.fn().mockResolvedValue({ status: 'reverted', transactionHash: '0xabc' })
    const setup = clients({ waitForTransactionReceipt })
    render(<Presale copy={siteContent.en.presale} contractAddress={contract} publicClient={setup.publicClient} walletClient={setup.walletClient} />)

    fireEvent.click(await screen.findByRole('button', { name: 'CONNECT BSC WALLET' }))
    fireEvent.click(await screen.findByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'CONFIRM 0.05 BNB PARTICIPATION' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('TRANSACTION NOT SENT: Transaction reverted')
    expect(screen.queryByText('THIS ADDRESS ALREADY PARTICIPATED')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CONFIRM 0.05 BNB PARTICIPATION' })).toBeEnabled()
  })

  it('rejects a successful receipt when the confirmed chain state did not record participation', async () => {
    const setup = clients({ participated: false })
    render(<Presale copy={siteContent.en.presale} contractAddress={contract} publicClient={setup.publicClient} walletClient={setup.walletClient} />)

    fireEvent.click(await screen.findByRole('button', { name: 'CONNECT BSC WALLET' }))
    fireEvent.click(await screen.findByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'CONFIRM 0.05 BNB PARTICIPATION' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('TRANSACTION NOT SENT: Participation was not recorded on-chain')
    expect(screen.queryByText(/TRANSACTION SUBMITTED/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CONFIRM 0.05 BNB PARTICIPATION' })).toBeEnabled()
  })

  it.each([
    {
      reason: 'cancelled',
      transaction: { hash: '0xcancelled', input: '0x', to: account, value: 0n },
      message: 'Transaction cancelled; participation was not recorded',
    },
    {
      reason: 'replaced',
      transaction: { hash: '0xreplaced', input: '0x12345678', to: account, value: 1n },
      message: 'Transaction replaced with a different call; participation was not recorded',
    },
  ])('reports a $reason transaction as not participated and unlocks retry', async ({ reason, transaction, message }) => {
    const waitForTransactionReceipt = vi.fn(async ({ onReplaced }: { onReplaced?: (replacement: unknown) => void }) => {
      const transactionReceipt = { status: 'success', transactionHash: transaction.hash }
      onReplaced?.({ reason, replacedTransaction: { hash: '0xabc' }, transaction, transactionReceipt })
      return transactionReceipt
    })
    const setup = clients({ waitForTransactionReceipt })
    render(<Presale copy={siteContent.en.presale} contractAddress={contract} publicClient={setup.publicClient} walletClient={setup.walletClient} />)

    fireEvent.click(await screen.findByRole('button', { name: 'CONNECT BSC WALLET' }))
    fireEvent.click(await screen.findByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'CONFIRM 0.05 BNB PARTICIPATION' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(`TRANSACTION NOT SENT: ${message}`)
    expect(screen.queryByText(/TRANSACTION SUBMITTED/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CONFIRM 0.05 BNB PARTICIPATION' })).toBeEnabled()
  })

  it('shows the final hash of a repriced presale transaction', async () => {
    let mined = false
    const finalHash = '0xrepriced'
    const waitForTransactionReceipt = vi.fn(async ({ onReplaced }: { onReplaced?: (replacement: unknown) => void }) => {
      mined = true
      const transactionReceipt = { status: 'success', transactionHash: finalHash }
      onReplaced?.({
        reason: 'repriced',
        replacedTransaction: { hash: '0xabc' },
        transaction: { hash: finalHash, input: '0xd11711a2', to: contract, value: 50_000_000_000_000_000n },
        transactionReceipt,
      })
      return transactionReceipt
    })
    const setup = clients({ state: () => ({ participated: mined }), waitForTransactionReceipt })
    render(<Presale copy={siteContent.en.presale} contractAddress={contract} publicClient={setup.publicClient} walletClient={setup.walletClient} />)

    fireEvent.click(await screen.findByRole('button', { name: 'CONNECT BSC WALLET' }))
    fireEvent.click(await screen.findByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'CONFIRM 0.05 BNB PARTICIPATION' }))

    expect(await screen.findByText(`TRANSACTION SUBMITTED: ${finalHash}`)).toBeInTheDocument()
  })

  it('keeps the independent submit lock while the language changes', async () => {
    let resolveReceipt!: (receipt: { status: 'success'; transactionHash: Address }) => void
    let mined = false
    const receipt = new Promise<{ status: 'success'; transactionHash: Address }>((resolve) => {
      resolveReceipt = resolve
    })
    const setup = clients({
      state: () => ({ participated: mined }),
      waitForTransactionReceipt: vi.fn(() => receipt),
    })
    const { rerender } = render(<Presale copy={siteContent.en.presale} contractAddress={contract} publicClient={setup.publicClient} walletClient={setup.walletClient} />)

    fireEvent.click(await screen.findByRole('button', { name: 'CONNECT BSC WALLET' }))
    fireEvent.click(await screen.findByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'CONFIRM 0.05 BNB PARTICIPATION' }))
    await waitFor(() => expect(setup.waitForTransactionReceipt).toHaveBeenCalledTimes(1))

    rerender(<Presale copy={siteContent.zh.presale} contractAddress={contract} publicClient={setup.publicClient} walletClient={setup.walletClient} />)
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 10)))

    const action = document.querySelector('.presale-interaction > button') as HTMLButtonElement
    expect(action).toBeDisabled()
    fireEvent.click(action)
    expect(setup.writeContract).toHaveBeenCalledTimes(1)

    mined = true
    resolveReceipt({ status: 'success', transactionHash: '0xabc' })
    expect(await screen.findByText(/交易已提交: 0xabc/)).toBeInTheDocument()
  })

  it('revalidates the live sale state immediately before sending', async () => {
    let paused = false
    const setup = clients({ state: () => ({ paused }) })
    render(<Presale copy={siteContent.en.presale} contractAddress={contract} publicClient={setup.publicClient} walletClient={setup.walletClient} />)

    fireEvent.click(await screen.findByRole('button', { name: 'CONNECT BSC WALLET' }))
    fireEvent.click(await screen.findByRole('checkbox'))
    paused = true
    fireEvent.click(screen.getByRole('button', { name: 'CONFIRM 0.05 BNB PARTICIPATION' }))

    expect(await screen.findByRole('button', { name: 'PRESALE PAUSED' })).toBeDisabled()
    expect(setup.writeContract).not.toHaveBeenCalled()
  })

  it('polls the presale state every 15 seconds', async () => {
    vi.restoreAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(frozenNow)
    const setup = clients()
    render(<Presale copy={siteContent.en.presale} contractAddress={contract} publicClient={setup.publicClient} walletClient={setup.walletClient} />)

    await act(async () => undefined)
    const initialReads = setup.readContract.mock.calls.length
    await act(async () => vi.advanceTimersByTimeAsync(15_000))

    expect(setup.readContract.mock.calls.length).toBeGreaterThan(initialReads)
  })

  it('updates the countdown every second between state polls', async () => {
    vi.restoreAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(frozenNow)
    const setup = clients()
    render(<Presale copy={siteContent.en.presale} contractAddress={contract} publicClient={setup.publicClient} walletClient={setup.walletClient} />)

    await act(async () => undefined)
    expect(screen.getByText('COUNTDOWN: 01:00:00')).toBeInTheDocument()
    await act(async () => vi.advanceTimersByTimeAsync(1_000))

    expect(screen.getByText('COUNTDOWN: 00:59:59')).toBeInTheDocument()
  })
})
