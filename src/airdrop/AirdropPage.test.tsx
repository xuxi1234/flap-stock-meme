import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { EIP1193Provider } from 'viem'
import AirdropPage from './AirdropPage'
vi.mock('viem', async importOriginal => ({
  ...await importOriginal<typeof import('viem')>(),
  createPublicClient: () => ({ readContract: async ({ functionName }: { functionName: string }) => functionName === 'decimals' ? 18 : functionName === 'balanceOf' ? 10000n : '蝴蝶股票' }),
}))
vi.mock('./LiveSendPanel', () => ({ default: ({ wallet }: { wallet: string }) => <div data-testid="sender">{wallet}</div> }))
it('reselects a permitted sender from the connected-wallet menu and clears stale sender on changes', async () => {
  const old = '0x1111111111111111111111111111111111111111'
  const next = '0xA7E4B6cD8083efd6dE9173021dB6fb42b4822914'
  let selected = old
  const listeners = new Map<string, () => void>()
  const request = vi.fn(async ({ method }) => {
    if (method === 'wallet_requestPermissions') { selected = next; listeners.get('accountsChanged')?.(); return [] }
    if (method === 'eth_chainId') return '0x38'
    return [selected]
  })
  const provider = { request, on: (event: string, cb: () => void) => listeners.set(event, cb), removeListener: (event: string) => listeners.delete(event) } as unknown as EIP1193Provider
  render(<AirdropPage />)
  act(() => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: { info: { uuid: 'mm-test', name: 'Test MetaMask', rdns: 'io.metamask', icon: '' }, provider } })))
  fireEvent.click(screen.getByRole('button', { name: '连接钱包' }))
  fireEvent.click(screen.getByRole('button', { name: 'Test MetaMask' }))
  await waitFor(() => expect(screen.getByTestId('sender').textContent).toBe(old))
  fireEvent.click(screen.getByRole('button', { name: /切换账户/ }))
  expect(screen.getByRole('dialog', { name: '选择钱包' })).toHaveTextContent(old)
  fireEvent.click(screen.getByRole('button', { name: '切换账户（打开钱包选择）' }))
  await waitFor(() => expect(screen.getByTestId('sender').textContent).toBe(next))
  expect(request).toHaveBeenCalledWith({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] })
  act(() => listeners.get('accountsChanged')?.())
  expect(screen.getByTestId('sender').textContent).toBe('')
  expect(screen.getByRole('dialog', { name: '选择钱包' })).toBeInTheDocument()
})
