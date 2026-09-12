import { describe, expect, it, vi } from 'vitest'
import type { EIP1193Provider } from 'viem'
import { requestSender } from './wallet'

const sender = '0xA7E4B6cD8083efd6dE9173021dB6fb42b4822914'
describe('airdrop account selection', () => {
  it('requests fresh account permissions before reading the newly selected account', async () => {
    let selected = '0x1111111111111111111111111111111111111111'
    const request = vi.fn(async ({ method }) => {
      if (method === 'wallet_requestPermissions') { selected = sender; return [] }
      if (method === 'eth_chainId') return '0x38'
      return [selected]
    })
    expect(await requestSender({ request } as unknown as EIP1193Provider, true)).toBe(sender)
    expect(request.mock.calls.map(([r]) => r.method)).toEqual(['wallet_requestPermissions', 'eth_requestAccounts', 'eth_chainId', 'eth_accounts'])
    expect(request).toHaveBeenNthCalledWith(1, { method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] })
  })
  it('does not reuse the old account when selection is cancelled or unsupported', async () => {
    for (const code of [4001, 4200, -32601]) {
      const request = vi.fn().mockRejectedValue({ code })
      await expect(requestSender({ request } as unknown as EIP1193Provider, true)).rejects.toThrow()
      expect(request).toHaveBeenCalledTimes(1)
    }
  })
  it('rejects a wrong chain and empty account access', async () => {
    const request = vi.fn(async ({ method }) => method === 'eth_chainId' ? '0x1' : [sender])
    await expect(requestSender({ request } as unknown as EIP1193Provider)).rejects.toThrow('BNB Smart Chain')
    request.mockImplementation(async () => [])
    await expect(requestSender({ request } as unknown as EIP1193Provider)).rejects.toThrow('账户')
  })
})
