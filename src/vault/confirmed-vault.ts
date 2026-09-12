import { getAddress, parseAbi, type PublicClient } from 'viem'
import { launchAbi, REVENUE, VAULT_PORTAL } from './protocol'

export const confirmedVault = {
  hash:'0x6e56ed60da568446c36cf2890f9a52ed1c93105a68a6bca6bc171bfc86c43c5f',
  token:getAddress('0xf5297ea286966dd54e5810d16becf4b449f57777'),
  vault:getAddress('0x608057051d1a3d6b3b6ddfee96c68d92cdb429d6'),
  factory:getAddress('0xfd2437dffb8ebe9f96125b30c85be22f99fdddf3'),
  processor:getAddress('0x2f3ec0015ffd814f8fdeab254d9d6814d09d1312'),
  fee:'0.000346831505780525',
} as const
const abi=parseAbi(['function taxToken() view returns (address)','function commissionReceiver() view returns (address)','function totalReceivedBnb() view returns (uint256)'])
export async function readConfirmedVault(c:PublicClient){
  if(await c.getChainId()!==56)throw Error('读取服务不在 BSC 主网')
  const block=await c.getBlockNumber()
  const [registry,vaultToken,processorToken,recipient,totalReceived,balance]=await Promise.all([
    c.readContract({address:VAULT_PORTAL,abi:launchAbi,functionName:'getVault',args:[confirmedVault.token],blockNumber:block}),
    c.readContract({address:confirmedVault.vault,abi,functionName:'taxToken',blockNumber:block}),
    c.readContract({address:confirmedVault.processor,abi,functionName:'taxToken',blockNumber:block}),
    c.readContract({address:confirmedVault.processor,abi,functionName:'commissionReceiver',blockNumber:block}),
    c.readContract({address:confirmedVault.vault,abi,functionName:'totalReceivedBnb',blockNumber:block}),
    c.getBalance({address:confirmedVault.vault,blockNumber:block}),
  ])
  if(registry.vault.toLowerCase()!==confirmedVault.vault.toLowerCase()||registry.vaultFactory.toLowerCase()!==confirmedVault.factory.toLowerCase()||vaultToken.toLowerCase()!==confirmedVault.token.toLowerCase()||processorToken.toLowerCase()!==confirmedVault.token.toLowerCase())throw Error('链上金库或代币对应关系发生变化，暂停显示核验结果')
  return {block,recipient,totalReceived,balance,recipientMatches:recipient.toLowerCase()===REVENUE.toLowerCase()}
}
