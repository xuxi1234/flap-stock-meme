import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Address, PublicClient, WalletClient } from 'viem'
import { siteContent } from '../content/siteContent'
import { Presale } from './Presale'

const contract = '0x1111111111111111111111111111111111111111' as Address
const account = '0x2222222222222222222222222222222222222222' as Address
const hash = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const
const frozenNow = 1_788_904_799_000

beforeEach(() => { vi.spyOn(Date, 'now').mockReturnValue(frozenNow); localStorage.clear() })
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear() })

function clients(options: { participated?: () => boolean; writeError?: unknown; receipt?: Promise<{ status: 'success' | 'reverted'; transactionHash: typeof hash }> | (() => Promise<{ status: 'success' | 'reverted'; transactionHash: typeof hash }>) } = {}) {
  const readContract = vi.fn(async ({ functionName }: { functionName: string }) => ({
    participantCount: 18n,
    endTime: 1_788_969_599n,
    paused: false,
    hasParticipated: options.participated?.() ?? false,
  })[functionName])
  const writeContract = options.writeError ? vi.fn().mockRejectedValue(options.writeError) : vi.fn().mockResolvedValue(hash)
  const waitForTransactionReceipt = vi.fn(() => typeof options.receipt === 'function' ? options.receipt() : options.receipt ?? Promise.resolve({ status: 'success' as const, transactionHash: hash }))
  const walletClient = { requestAddresses: vi.fn().mockResolvedValue([account]), getAddresses: vi.fn().mockResolvedValue([account]), getChainId: vi.fn().mockResolvedValue(56), switchChain: vi.fn(), writeContract } as unknown as WalletClient
  return { publicClient: { readContract, waitForTransactionReceipt } as unknown as PublicClient, walletClient, writeContract, waitForTransactionReceipt }
}

async function connectAndAgree() {
  fireEvent.click(await screen.findByRole('button', { name: 'CHOOSE & CONNECT WALLET' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'CONFIRM 0.05 BNB PAYMENT' })).toBeEnabled())
}

describe('participation transaction feedback', () => {
  it('ends website participation at the earlier cutoff even while the contract remains open', async () => {
    vi.mocked(Date.now).mockReturnValue(1_788_908_399_000)
    const setup = clients()
    render(<Presale copy={siteContent.en.presale} contractAddress={contract} publicClient={setup.publicClient} walletClient={setup.walletClient} />)
    expect(await screen.findByText('00:00:00:00')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'CHOOSE & CONNECT WALLET' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'PRIVATE SALE HAS ENDED' })).toBeDisabled())
    expect(setup.writeContract).not.toHaveBeenCalled()
  })

  it('shows the countdown without removed statistics or checkbox', async () => {
    const setup = clients()
    render(<Presale copy={siteContent.en.presale} contractAddress={contract} publicClient={setup.publicClient} walletClient={setup.walletClient} />)
    expect(await screen.findByText('00:01:00:00')).toBeInTheDocument()
    expect(screen.queryByText('18 / 10,000')).not.toBeInTheDocument()
    expect(screen.queryByText('0.90 BNB')).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('shows the hash immediately after broadcast and then confirms from fresh chain state', async () => {
    let resolveReceipt!: (value: { status: 'success'; transactionHash: typeof hash }) => void
    let participated = false
    const receipt = new Promise<{ status: 'success'; transactionHash: typeof hash }>((resolve) => { resolveReceipt = resolve })
    const setup = clients({ participated: () => participated, receipt })
    render(<Presale copy={siteContent.en.presale} contractAddress={contract} publicClient={setup.publicClient} walletClient={setup.walletClient} />)
    await connectAndAgree()
    fireEvent.click(screen.getByRole('button', { name: 'CONFIRM 0.05 BNB PAYMENT' }))

    const explorer = await screen.findByRole('link', { name: 'VIEW ON BSCSCAN' })
    expect(explorer).toHaveAttribute('href', `https://bscscan.com/tx/${hash}`)
    expect(screen.getByText('WAITING FOR ON-CHAIN CONFIRMATION')).toBeInTheDocument()

    participated = true
    resolveReceipt({ status: 'success', transactionHash: hash })
    expect((await screen.findAllByText('PARTICIPATION CONFIRMED ON-CHAIN')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('THIS ADDRESS HAS AN ON-CHAIN PARTICIPATION RECORD')).toBeInTheDocument()
  })

  it('preserves a broadcast hash when receipt lookup fails', async () => {
    const setup = clients({ receipt: async () => { throw new Error('RPC unavailable') } })
    render(<Presale copy={siteContent.en.presale} contractAddress={contract} publicClient={setup.publicClient} walletClient={setup.walletClient} />)
    await connectAndAgree()
    fireEvent.click(screen.getByRole('button', { name: 'CONFIRM 0.05 BNB PAYMENT' }))

    expect(await screen.findByText(/BROADCAST SUCCEEDED, BUT THE FINAL RESULT/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'VIEW ON BSCSCAN' })).toHaveAttribute('href', `https://bscscan.com/tx/${hash}`)
    expect(screen.queryByText(/NOTHING WAS BROADCAST/)).not.toBeInTheDocument()
  })

  it('labels wallet rejection before broadcast and provides no fake hash', async () => {
    const setup = clients({ writeError: { code: 4001, message: 'User rejected request' } })
    render(<Presale copy={siteContent.en.presale} contractAddress={contract} publicClient={setup.publicClient} walletClient={setup.walletClient} />)
    await connectAndAgree()
    fireEvent.click(screen.getByRole('button', { name: 'CONFIRM 0.05 BNB PAYMENT' }))
    expect(await screen.findByText('CANCELLED IN WALLET — NOTHING WAS BROADCAST')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'VIEW ON BSCSCAN' })).not.toBeInTheDocument()
  })

  it('opens real wallet guidance when no injected provider is detected', async () => {
    const setup = clients()
    render(<Presale copy={siteContent.en.presale} contractAddress={contract} publicClient={setup.publicClient} />)
    fireEvent.click(await screen.findByRole('button', { name: 'CHOOSE & CONNECT WALLET' }))
    expect(screen.getByRole('dialog', { name: 'CHOOSE A BSC WALLET' })).toBeInTheDocument()
    expect(screen.getByText('NO WALLET DETECTED IN THIS BROWSER')).toBeInTheDocument()
    expect(screen.getByText(/QR connection is not configured/)).toBeInTheDocument()
  })

  it('stores and shows the latest submitted record for the connected address', async () => {
    let resolveReceipt!: (value: { status: 'success'; transactionHash: typeof hash }) => void
    const receipt = new Promise<{ status: 'success'; transactionHash: typeof hash }>((resolve) => { resolveReceipt = resolve })
    const setup = clients({ receipt })
    render(<Presale copy={siteContent.en.presale} contractAddress={contract} publicClient={setup.publicClient} walletClient={setup.walletClient} />)
    await connectAndAgree()
    fireEvent.click(screen.getByRole('button', { name: 'CONFIRM 0.05 BNB PAYMENT' }))
    expect(await screen.findByText('LATEST SAVED TRANSACTION')).toBeInTheDocument()
    expect(screen.getAllByText(hash).length).toBeGreaterThanOrEqual(1)
    await act(async () => resolveReceipt({ status: 'success', transactionHash: hash }))
  })
})
