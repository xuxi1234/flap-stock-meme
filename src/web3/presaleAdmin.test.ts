import { describe, expect, it, vi } from 'vitest'
import type { PublicClient, WalletClient } from 'viem'
import { projectConfig } from '../config/project'
import { submitDeadlineUpdate } from './presaleAdmin'

function clients(endTime = 1_788_969_599n, account: string = projectConfig.presale.adminAddress) {
  const simulateContract = vi.fn(async (request: unknown) => ({ request }))
  const writeContract = vi.fn().mockResolvedValue('0xabc')
  const read = {
    getChainId: vi.fn().mockResolvedValue(56),
    readContract: vi.fn(async ({ functionName }: { functionName: string }) => functionName === 'owner' ? projectConfig.presale.adminAddress : endTime),
    simulateContract,
  }
  const wallet = { getAddresses: vi.fn().mockResolvedValue([account]), getChainId: vi.fn().mockResolvedValue(56), switchChain: vi.fn(), writeContract }
  return { read, wallet, simulateContract, writeContract, client: read as unknown as PublicClient, signer: wallet as unknown as WalletClient }
}

describe('deadline administration', () => {
  it('only submits the simulated deadline call to the configured contract', async () => {
    const c = clients()
    await expect(submitDeadlineUpdate(c.client, c.signer)).resolves.toBe('0xabc')
    expect(c.simulateContract).toHaveBeenCalledWith(expect.objectContaining({
      address: projectConfig.presale.contractAddress, account: projectConfig.presale.adminAddress,
      functionName: 'setEndTime', args: [1_789_142_400n], chain: expect.objectContaining({ id: 56 }),
    }))
    expect(c.writeContract).toHaveBeenCalledTimes(1)
    expect(c.writeContract.mock.calls[0][0]).not.toHaveProperty('value')
  })
  it('does not submit again when chain state already matches', async () => {
    const c = clients(1_789_142_400n)
    await expect(submitDeadlineUpdate(c.client, c.signer)).resolves.toBeNull()
    expect(c.writeContract).not.toHaveBeenCalled()
  })
  it('rejects a non-owner before simulation or signing', async () => {
    const c = clients(undefined, '0x1111111111111111111111111111111111111111')
    await expect(submitDeadlineUpdate(c.client, c.signer)).rejects.toThrow('管理员钱包')
    expect(c.simulateContract).not.toHaveBeenCalled()
    expect(c.writeContract).not.toHaveBeenCalled()
  })
  it('rejects the wrong RPC network and a switched wallet account', async () => {
    const c = clients()
    c.read.getChainId.mockResolvedValueOnce(97)
    await expect(submitDeadlineUpdate(c.client, c.signer)).rejects.toThrow('BSC 主网')
    c.wallet.getAddresses.mockResolvedValueOnce([projectConfig.presale.adminAddress]).mockResolvedValueOnce(['0x1111111111111111111111111111111111111111'])
    await expect(submitDeadlineUpdate(c.client, c.signer)).rejects.toThrow('钱包地址或网络已改变')
    expect(c.writeContract).not.toHaveBeenCalled()
  })
  it('does not broadcast when the simulation fails', async () => {
    const c = clients()
    c.simulateContract.mockRejectedValueOnce(new Error('simulation failed'))
    await expect(submitDeadlineUpdate(c.client, c.signer)).rejects.toThrow('simulation failed')
    expect(c.writeContract).not.toHaveBeenCalled()
  })
})
