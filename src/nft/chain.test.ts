import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {keccak256,encodeFunctionData} from 'viem';
const mock=vi.hoisted(()=>({write:vi.fn(),provider:vi.fn()}));
vi.mock('viem',async original=>({...await original<typeof import('viem')>(),createWalletClient:()=>({writeContract:mock.write})}));
vi.mock('./deployment.json',()=>({default:{enabled:true,chainId:56,collection:'0x3333333333333333333333333333333333333333',market:'0x4444444444444444444444444444444444444444',collectionCodeHash:'',marketCodeHash:'',assetBase:'https://example.org/nft'}}));
import {nftAbi,config,publicClient,readState,transact,validateLive} from './chain';
import {MINT_WEI,TREASURY} from './model';
const account='0x1111111111111111111111111111111111111111',inviter='0x2222222222222222222222222222222222222222',hash=('0x'+'1'.repeat(64)) as `0x${string}`;
let values:Record<string,unknown>;
beforeEach(()=>{vi.restoreAllMocks();config.collectionCodeHash=keccak256('0x6000');config.marketCodeHash=keccak256('0x6000');values={MINT_PRICE:MINT_WEI,MAX_SUPPLY:7777n,TREASURY,FEE_BPS:0n,collection:config.collection,REFERRAL_BPS:2000n,MAX_BATCH:20n,totalSupply:0n,reserved:5n,listedTokenCount:0n,balanceOf:0n,payerRequestCount:1n,payerRequests:[9n],requests:[account,12n,false,5n,inviter],requestTokenIds:[12n,34n,56n,78n,90n],referrers:inviter,invitedCount:2n,referralMintCount:5n,referralEarned:10000000000000000n,referralRewards:8000000000000000n};vi.spyOn(publicClient,'getChainId').mockResolvedValue(56);vi.spyOn(publicClient,'getCode').mockResolvedValue('0x6000');vi.spyOn(publicClient,'readContract').mockImplementation(async args=>values[args.functionName] as never);vi.spyOn(publicClient,'simulateContract').mockImplementation(async args=>({request:args}) as never);vi.spyOn(publicClient,'waitForTransactionReceipt').mockResolvedValue({status:'success',transactionHash:hash} as never);mock.write.mockReset().mockResolvedValue(hash);mock.provider.mockReset().mockImplementation(async({method})=>method==='eth_accounts'?[account]:'0x38');vi.stubGlobal('ethereum',{request:mock.provider})});
afterEach(()=>vi.unstubAllGlobals());
it('reads actual batch IDs and all referral statistics',async()=>{const state=await readState(account);expect(state.pending).toEqual([{requestId:9n,quantity:5,tokenIds:[12,34,56,78,90]}]);expect(state.referral).toEqual({bound:inviter,invited:2n,minted:5n,earned:10000000000000000n,rewards:8000000000000000n});expect((await readState()).referral).toBeNull()});
it('simulates exact batch overload/payment and withdraws to connected account',async()=>{const onHash=vi.fn();await transact('mint',account,{quantity:5,referrer:inviter},onHash);expect(publicClient.simulateContract).toHaveBeenCalledWith(expect.objectContaining({functionName:'requestMint',args:[5n,inviter],value:50000000000000000n,account}));expect(onHash).toHaveBeenCalledWith(hash);await transact('withdraw',account,{},onHash);expect(publicClient.simulateContract).toHaveBeenLastCalledWith(expect.objectContaining({functionName:'withdrawReferralRewards',args:[account],account}));expect(publicClient.waitForTransactionReceipt).toHaveBeenCalledWith({hash,confirmations:2,timeout:180000,onReplaced:expect.any(Function)})});
it('rejects reverted receipts and changed wallet before sending',async()=>{vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValue({status:'reverted',transactionHash:hash} as never);await expect(transact('claim',account,{requestId:9n},vi.fn())).rejects.toThrow('链上交易失败');mock.write.mockClear();mock.provider.mockResolvedValue([inviter]);await expect(transact('withdraw',account,{},vi.fn())).rejects.toThrow('钱包地址已变化');expect(mock.write).not.toHaveBeenCalled()});
it.each([['REFERRAL_BPS',1000n],['MAX_BATCH',1n],['MINT_PRICE',1n]])('fails closed on changed economics %s',async(key,value)=>{values[key]=value;await expect(validateLive()).rejects.toThrow('合约核验失败')});

const replacementHash=('0x'+'2'.repeat(64)) as `0x${string}`;
it.each(['cancelled','replaced'] as const)('rejects a successful %s replacement receipt',async reason=>{
 vi.mocked(publicClient.waitForTransactionReceipt).mockImplementation(async args=>{args.onReplaced?.({reason} as never);return {status:'success',transactionHash:replacementHash} as never});
 const onHash=vi.fn();await expect(transact('claim',account,{requestId:9n},onHash)).rejects.toThrow('原操作未确认');expect(onHash).toHaveBeenCalledTimes(1);
});
it.each([true,false])('accepts identical speed-up and updates hash (replacement callback %s)',async notify=>{
 vi.mocked(publicClient.waitForTransactionReceipt).mockImplementation(async args=>{if(notify)args.onReplaced?.({reason:'repriced'} as never);return {status:'success',transactionHash:replacementHash} as never});
 vi.spyOn(publicClient,'getTransaction').mockResolvedValue({from:account,to:config.collection,value:0n,input:encodeFunctionData({abi:nftAbi,functionName:'claim',args:[9n,account]})} as never);
 const onHash=vi.fn();await expect(transact('claim',account,{requestId:9n},onHash)).resolves.toMatchObject({transactionHash:replacementHash});expect(onHash.mock.calls).toEqual([[hash],[replacementHash]]);
});
it.each(['recipient','value','calldata','sender'])('rejects changed %s without relying on replacement callback',async field=>{
 vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValue({status:'success',transactionHash:replacementHash} as never);
 const transaction={from:account,to:config.collection,value:0n,input:encodeFunctionData({abi:nftAbi,functionName:'claim',args:[9n,account]})};
 if(field==='recipient')transaction.to=account;if(field==='value')transaction.value=1n;if(field==='sender')transaction.from=inviter;if(field==='calldata')transaction.input='0x';
 vi.spyOn(publicClient,'getTransaction').mockResolvedValue(transaction as never);
 await expect(transact('claim',account,{requestId:9n},vi.fn())).rejects.toThrow('原操作未确认');
});
