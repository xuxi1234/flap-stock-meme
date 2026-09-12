import {beforeEach,expect,it,vi} from 'vitest'
import {type PublicClient,type WalletClient} from 'viem'
import {OWNER,BUDGET} from './protocol'
import {prepareDeployment,submit,records} from './service'
const hash=('0x'+'b'.repeat(64)) as `0x${string}`
const deployed='0x1111111111111111111111111111111111111111'
beforeEach(()=>localStorage.clear())
it('simulates creation without a to address, sends only after review and saves deployed address',async()=>{
 const c={getChainId:vi.fn().mockResolvedValue(56),call:vi.fn().mockResolvedValue({}),estimateGas:vi.fn().mockResolvedValue(3000000n),getGasPrice:vi.fn().mockResolvedValue(50000000n),getBalance:vi.fn().mockResolvedValue(BUDGET),waitForTransactionReceipt:vi.fn().mockResolvedValue({status:'success',contractAddress:deployed,gasUsed:3000000n,effectiveGasPrice:50000000n,logs:[]}),getTransaction:vi.fn().mockResolvedValue({from:OWNER,to:null,value:0n}),getCode:vi.fn().mockResolvedValue('0x1234')}
 const w={getChainId:vi.fn().mockResolvedValue(56),getAddresses:vi.fn().mockResolvedValue([OWNER]),sendTransaction:vi.fn().mockResolvedValue(hash)}
 const p=await prepareDeployment(c as unknown as PublicClient,OWNER,'0x1234','部署 Mint 工厂')
 expect(c.call).toHaveBeenCalledWith(expect.objectContaining({account:OWNER,data:'0x1234',value:0n}))
 expect(p.to).toBeUndefined();expect(w.sendTransaction).not.toHaveBeenCalled()
 const r=await submit(c as unknown as PublicClient,w as unknown as WalletClient,p,()=>{})
 expect(w.sendTransaction.mock.calls[0][0].to).toBeUndefined();expect(r.contractAddress).toBe(deployed);expect(records()[0].status).toBe('success')
})
it('creation simulation failure prevents preparation',async()=>{
 const c={getChainId:vi.fn().mockResolvedValue(56),call:vi.fn().mockRejectedValue(Error('constructor reverted'))}
 await expect(prepareDeployment(c as unknown as PublicClient,OWNER,'0x1234','deploy')).rejects.toThrow('constructor reverted')
})
