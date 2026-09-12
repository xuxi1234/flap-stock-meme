import {describe,it,expect,vi} from 'vitest'
import {type PublicClient} from 'viem'
import {OWNER,REVENUE,VAULT_PORTAL} from './protocol'
import {mintDeployData,verifyMintDeployment,readCampaign} from './mint'
const factory='0x1111111111111111111111111111111111111111',impl='0x2222222222222222222222222222222222222222',hash=('0x'+'a'.repeat(64)) as `0x${string}`
const rpc=()=>({getChainId:vi.fn().mockResolvedValue(56),getTransaction:vi.fn().mockResolvedValue({from:OWNER,to:null,value:0n,input:mintDeployData}),getTransactionReceipt:vi.fn().mockResolvedValue({status:'success',contractAddress:factory,blockNumber:100n}),getBlockNumber:vi.fn().mockResolvedValue(101n),getCode:vi.fn().mockResolvedValue('0x1234'),readContract:vi.fn().mockImplementation(({functionName})=>Promise.resolve(({owner:OWNER,commissionReceiver:REVENUE,vaultPortal:VAULT_PORTAL,implementation:impl} as Record<string,string>)[functionName]))})
describe('Mint deployment provenance',()=>{
 it('accepts only a successful exact-bytecode deployment with the frozen permissions',async()=>{const c=rpc();expect(await verifyMintDeployment(c as unknown as PublicClient,hash)).toEqual({address:factory,implementation:impl,hash});expect(mintDeployData.length).toBeLessThan(39000)})
 it('rejects a different implementation deployment even with the expected owner',async()=>{const c=rpc();c.getTransaction.mockResolvedValue({from:OWNER,to:null,value:0n,input:'0x1234'});await expect(verifyMintDeployment(c as unknown as PublicClient,hash)).rejects.toThrow('本版本')})
 it('rejects insufficient confirmations and changed revenue recipient',async()=>{const c=rpc();c.getBlockNumber.mockResolvedValue(100n);await expect(verifyMintDeployment(c as unknown as PublicClient,hash)).rejects.toThrow('两个区块');c.getBlockNumber.mockResolvedValue(101n);c.readContract.mockImplementation(({functionName})=>Promise.resolve(({owner:OWNER,commissionReceiver:impl,vaultPortal:VAULT_PORTAL,implementation:impl} as Record<string,string>)[functionName]));await expect(verifyMintDeployment(c as unknown as PublicClient,hash)).rejects.toThrow('配置不匹配')})
 it('rejects unrelated campaigns before reading balances or enabling writes',async()=>{const c=rpc();c.readContract.mockResolvedValue(false);await expect(readCampaign(c as unknown as PublicClient,factory,impl,OWNER)).rejects.toThrow('不属于');expect(c.readContract).toHaveBeenCalledTimes(1)})
})
