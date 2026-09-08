import { type PublicClient, type WalletClient } from 'viem'
import { bsc } from 'viem/chains'
import { projectConfig } from '../config/project'

export const deadlineAdminAbi = [
  { type: 'function', name: 'owner', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'endTime', inputs: [], outputs: [{ type: 'uint64' }], stateMutability: 'view' },
  { type: 'function', name: 'setEndTime', inputs: [{ name: 'newEndTime', type: 'uint64' }], outputs: [], stateMutability: 'nonpayable' },
] as const

export async function readDeadlineAdminState(client: PublicClient) {
  const address = projectConfig.presale.contractAddress
  if (!address) throw new Error('私募合约尚未配置')
  if (await client.getChainId() !== 56) throw new Error('请使用 BSC 主网')
  const [owner, endTime] = await Promise.all([
    client.readContract({ address, abi: deadlineAdminAbi, functionName: 'owner' }),
    client.readContract({ address, abi: deadlineAdminAbi, functionName: 'endTime' }),
  ])
  return { owner, endTime }
}

export async function submitDeadlineUpdate(client: PublicClient, wallet: WalletClient) {
  const address = projectConfig.presale.contractAddress
  if (!address) throw new Error('私募合约尚未配置')
  const state = await readDeadlineAdminState(client)
  const target = BigInt(projectConfig.presale.websiteDeadline)
  if (state.endTime === target) return null
  const [account] = await wallet.getAddresses()
  if (!account || account.toLowerCase() !== state.owner.toLowerCase()
    || account.toLowerCase() !== projectConfig.presale.adminAddress.toLowerCase()) {
    throw new Error('请连接当前合约管理员钱包')
  }
  if (await wallet.getChainId() !== 56) await wallet.switchChain({ id: 56 })
  const [current] = await wallet.getAddresses()
  if (current?.toLowerCase() !== account.toLowerCase() || await wallet.getChainId() !== 56) {
    throw new Error('钱包地址或网络已改变，请重新连接')
  }
  const { request } = await client.simulateContract({
    account, address, abi: deadlineAdminAbi, functionName: 'setEndTime', args: [target], chain: bsc,
  })
  return wallet.writeContract({ ...request, account, chain: bsc })
}
