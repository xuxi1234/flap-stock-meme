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

export type DeadlineUpdateStage = 'checking' | 'switching' | 'simulating' | 'wallet'

export function deadlineAdminError(error: unknown): string {
  let current = error
  let code: number | undefined
  let detail = '未知错误'
  for (let depth = 0; current && typeof current === 'object' && depth < 8; depth++) {
    const item = current as { code?: number; shortMessage?: string; message?: string; cause?: unknown }
    if (typeof item.code === 'number') code = item.code
    if (item.shortMessage || item.message) detail = (item.shortMessage || item.message)!.split('\n')[0].slice(0, 240)
    current = item.cause
  }
  if (code === 4001) return '你已在钱包中取消本次请求，尚未发送修改交易。'
  if (code === -32002 && /pending|already/i.test(detail)) return '钱包已有待处理请求（-32002）。请点击浏览器右上角 MetaMask，先处理其中的确认窗口，再返回重试。'
  return `${detail}${code !== undefined ? `（错误码 ${code}）` : ''}`
}

export async function submitDeadlineUpdate(client: PublicClient, wallet: WalletClient, onProgress: (stage: DeadlineUpdateStage) => void = () => {}) {
  const address = projectConfig.presale.contractAddress
  if (!address) throw new Error('私募合约尚未配置')
  onProgress('checking')
  const state = await readDeadlineAdminState(client)
  const target = BigInt(projectConfig.presale.websiteDeadline)
  if (state.endTime === target) return null
  const [account] = await wallet.getAddresses()
  if (!account || account.toLowerCase() !== state.owner.toLowerCase()
    || account.toLowerCase() !== projectConfig.presale.adminAddress.toLowerCase()) {
    throw new Error('请连接当前合约管理员钱包')
  }
  if (await wallet.getChainId() !== 56) {
    onProgress('switching')
    await wallet.switchChain({ id: 56 })
  }
  const [current] = await wallet.getAddresses()
  if (current?.toLowerCase() !== account.toLowerCase() || await wallet.getChainId() !== 56) {
    throw new Error('钱包地址或网络已改变，请重新连接')
  }
  onProgress('simulating')
  const { request } = await client.simulateContract({
    account, address, abi: deadlineAdminAbi, functionName: 'setEndTime', args: [target], chain: bsc,
  })
  onProgress('wallet')
  return wallet.writeContract({ ...request, account, chain: bsc })
}
