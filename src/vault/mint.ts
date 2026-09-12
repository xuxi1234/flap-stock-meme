import {encodeDeployData,encodeFunctionData,getAddress,type Abi,type Address,type Hex,type PublicClient} from 'viem'
import artifacts from './mint-artifacts.json'
import {OWNER,REVENUE,VAULT_PORTAL} from './protocol'
export const mintFactoryAbi=artifacts.factoryAbi as Abi
export const mintCampaignAbi=artifacts.campaignAbi as Abi
export const mintDeployData=encodeDeployData({abi:mintFactoryAbi,bytecode:artifacts.bytecode as Hex,args:[OWNER,REVENUE,VAULT_PORTAL]})
export const mintFactoryData=(functionName:string,args:unknown[]=[])=>encodeFunctionData({abi:mintFactoryAbi,functionName,args})
export const mintCampaignData=(functionName:string,args:unknown[]=[])=>encodeFunctionData({abi:mintCampaignAbi,functionName,args})
export async function verifyMintDeployment(c:PublicClient,hash:Hex){
 if(await c.getChainId()!==56)throw Error('当前读取网络不是 BSC')
 const [tx,r]=await Promise.all([c.getTransaction({hash}),c.getTransactionReceipt({hash})])
 if(r.status!=='success'||!r.contractAddress||tx.to||tx.from.toLowerCase()!==OWNER.toLowerCase()||tx.value!==0n||tx.input.toLowerCase()!==mintDeployData.toLowerCase())throw Error('此回执不是本版本 Mint 工厂的管理员部署交易')
 if(await c.getBlockNumber()<r.blockNumber+1n)throw Error('请等待至少两个区块确认')
 const address=getAddress(r.contractAddress)
 const code=await c.getCode({address});if(!code||code==='0x')throw Error('工厂代码尚不可用')
 const read=(functionName:string)=>c.readContract({address,abi:mintFactoryAbi,functionName})
 const [owner,receiver,portal,implementation]=await Promise.all(['owner','commissionReceiver','vaultPortal','implementation'].map(read)) as Address[]
 if(owner.toLowerCase()!==OWNER.toLowerCase()||receiver.toLowerCase()!==REVENUE.toLowerCase()||portal.toLowerCase()!==VAULT_PORTAL.toLowerCase())throw Error('链上权限配置不匹配')
 const implementationCode=await c.getCode({address:implementation});if(!implementationCode||implementationCode==='0x')throw Error('Mint 实现代码不存在')
 return {address,implementation,hash}
}
export async function readCampaign(c:PublicClient,factory:Address,address:Address,participant:Address){
 const blockNumber=await c.getBlockNumber()
 const registered=await c.readContract({address:factory,abi:mintFactoryAbi,functionName:'isCampaign',args:[address],blockNumber})
 if(registered!==true)throw Error('此项目不属于已核验的蝴蝶 Mint 工厂')
 const read=(functionName:string,args:unknown[]=[])=>c.readContract({address,abi:mintCampaignAbi,functionName,args,blockNumber})
 const [config,creator,total,target,deadline,launched,aborted,shares,claimable,token,ownerFactory,receiver]=await Promise.all([
  read('config'),read('creator'),read('totalShares'),read('targetShares'),read('deadline'),read('launched'),read('aborted'),read('sharesOf',[participant]),read('claimable',[participant]),read('token'),read('factory'),read('commissionReceiver')])
 if(String(ownerFactory).toLowerCase()!==factory.toLowerCase()||String(receiver).toLowerCase()!==REVENUE.toLowerCase())throw Error('Mint 项目关联关系不匹配')
 return {address,config:config as {name:string;symbol:string;minimumTokensOut:bigint;meta:string},creator:creator as Address,total:total as bigint,target:target as bigint,deadline:deadline as bigint,launched:launched as boolean,aborted:aborted as boolean,shares:shares as bigint,claimable:claimable as [bigint,bigint],token:token as Address,blockNumber}
}
