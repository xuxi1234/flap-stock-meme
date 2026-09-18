import {createPublicClient,createWalletClient,http,custom,parseAbi,encodeFunctionData,isAddress,keccak256,zeroAddress,type Address,type Hash,type EIP1193Provider,type EncodeFunctionDataParameters,type WriteContractParameters} from 'viem';
import {bsc} from 'viem/chains';
import deployment from './deployment.json';
import {MINT_WEI,NFT_SUPPLY,TREASURY,MAX_BATCH,REFERRAL_BPS,mintQuote,validateReferrer,type Listing} from './model';
export const nftAbi=parseAbi([
 'function MINT_PRICE() view returns(uint256)','function MAX_SUPPLY() view returns(uint256)','function TREASURY() view returns(address)',
 'function totalSupply() view returns(uint256)','function reserved() view returns(uint256)','function tokenByIndex(uint256) view returns(uint256)',
 'function tokenOfOwnerByIndex(address,uint256) view returns(uint256)','function balanceOf(address) view returns(uint256)',
 'function ownerOf(uint256) view returns(address)','function approve(address,uint256)','function getApproved(uint256) view returns(address)',
 'function REFERRAL_BPS() view returns(uint256)','function MAX_BATCH() view returns(uint256)','function referrers(address) view returns(address)','function invitedCount(address) view returns(uint256)','function referralMintCount(address) view returns(uint256)','function referralEarned(address) view returns(uint256)','function referralRewards(address) view returns(uint256)','function withdrawReferralRewards(address)','function bindReferrer(address)','function requestTokenIds(uint256) view returns(uint256[])','function requestMint(uint256,address) payable returns(uint256)','function claim(uint256,address)','function requests(uint256) view returns(address payer,uint256 tokenId,bool claimed,uint256 quantity,address referrer)',
 'function payerRequestCount(address) view returns(uint256)','function payerRequests(address,uint256,uint256) view returns(uint256[])',
 'function tokenURI(uint256) view returns(string)','function contractURI() view returns(string)',
]);
export const marketAbi=parseAbi(['function FEE_BPS() view returns(uint256)','function collection() view returns(address)','function listings(uint256) view returns(address seller,uint256 price)','function isListingActive(uint256) view returns(bool)','function listedTokenCount() view returns(uint256)','function listedTokenIds(uint256,uint256) view returns(uint256[])','function list(uint256,uint256)','function cancel(uint256)','function listingVersion(uint256) view returns(uint256)','function buy(uint256,address,uint256) payable']);
export type Deployment={enabled:boolean;chainId:number;collection:string;market:string;collectionCodeHash:string;marketCodeHash:string;assetBase:string;reason?:string};
export function validateDeployment(d:Deployment){
 if(!d.enabled)throw Error(d.reason||'尚未开放链上交易');
 if(d.chainId!==56||!isAddress(d.collection)||!isAddress(d.market)||d.collection===zeroAddress||d.market===zeroAddress||d.collection.toLowerCase()===d.market.toLowerCase())throw Error('主网合约配置无效');
 if(!/^0x[0-9a-f]{64}$/i.test(d.collectionCodeHash)||!/^0x[0-9a-f]{64}$/i.test(d.marketCodeHash)||!/^https:\/\//.test(d.assetBase))throw Error('缺少已核验的合约或图片配置');
 return d as Deployment&{collection:Address;market:Address};
}
export const config=deployment;
export const publicClient=createPublicClient({chain:bsc,batch:{multicall:{wait:20,batchSize:2048}},transport:http('/api/swap-rpc',{timeout:20000,retryCount:1})});
export function walletProvider(){return (window as unknown as {ethereum?:EIP1193Provider}).ethereum;}
export async function connect(){const provider=walletProvider();if(!provider)throw Error('请在 TokenPocket 的 DApp 浏览器打开本站，或安装兼容钱包');if(await provider.request({method:'eth_chainId'})!=='0x38')await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x38'}]});const accounts=await provider.request({method:'eth_requestAccounts'});if(!accounts[0])throw Error('未获得钱包地址');return accounts[0];}
export async function validateLive(){
 const d=validateDeployment(deployment);
 const [network,nftCode,marketCode,price,supply,treasury,fee,collection,referralBps,maxBatch]=await Promise.all([
 publicClient.getChainId(),publicClient.getCode({address:d.collection}),publicClient.getCode({address:d.market}),
 publicClient.readContract({address:d.collection,abi:nftAbi,functionName:'MINT_PRICE'}),publicClient.readContract({address:d.collection,abi:nftAbi,functionName:'MAX_SUPPLY'}),publicClient.readContract({address:d.collection,abi:nftAbi,functionName:'TREASURY'}),
 publicClient.readContract({address:d.market,abi:marketAbi,functionName:'FEE_BPS'}),publicClient.readContract({address:d.market,abi:marketAbi,functionName:'collection'}),publicClient.readContract({address:d.collection,abi:nftAbi,functionName:'REFERRAL_BPS'}),publicClient.readContract({address:d.collection,abi:nftAbi,functionName:'MAX_BATCH'})]);
 if(referralBps!==REFERRAL_BPS||maxBatch!==BigInt(MAX_BATCH)||network!==56||!nftCode||!marketCode||keccak256(nftCode)!==d.collectionCodeHash||keccak256(marketCode)!==d.marketCodeHash||price!==MINT_WEI||supply!==BigInt(NFT_SUPPLY)||treasury.toLowerCase()!==TREASURY.toLowerCase()||fee!==0n||collection.toLowerCase()!==d.collection.toLowerCase())throw Error('合约核验失败，已停止付款入口');
 return d;
}
async function chunks<T,R>(items:readonly T[],fn:(item:T)=>Promise<R>):Promise<R[]>{const result:R[]=[];for(let i=0;i<items.length;i+=64)result.push(...await Promise.all(items.slice(i,i+64).map(fn)));return result;}
export type PendingMint={requestId:bigint;quantity:number;tokenIds:number[]};
export async function readState(account?:Address){
 const d=await validateLive();
 const total=await publicClient.readContract({address:d.collection,abi:nftAbi,functionName:'totalSupply'});
 const reserved=await publicClient.readContract({address:d.collection,abi:nftAbi,functionName:'reserved'});
 if(total>7777n||reserved>7777n)throw Error('供应量异常');
 // Enumerable IDs avoid historical log-range limits on wallet and paid RPC providers.
 const candidateCount=await publicClient.readContract({address:d.market,abi:marketAbi,functionName:'listedTokenCount'});
 if(candidateCount>7777n)throw Error('挂单数量异常');
 const ids:bigint[]=[];
 for(let offset=0n;offset<candidateCount;offset+=100n)ids.push(...await publicClient.readContract({address:d.market,abi:marketAbi,functionName:'listedTokenIds',args:[offset,100n]}));
 const rows=await chunks(ids,async id=>{const [l,active,version]=await Promise.all([publicClient.readContract({address:d.market,abi:marketAbi,functionName:'listings',args:[id]}),publicClient.readContract({address:d.market,abi:marketAbi,functionName:'isListingActive',args:[id]}),publicClient.readContract({address:d.market,abi:marketAbi,functionName:'listingVersion',args:[id]})]);return{id:Number(id),seller:l[0],price:l[1],active,version} as Listing;});
 const owned:number[]=[],pending:PendingMint[]=[];
 let referral:ReferralState|null=null;
 if(account){
  const [bound,invited,minted,earned,rewards]=await Promise.all((['referrers','invitedCount','referralMintCount','referralEarned','referralRewards'] as const).map(functionName=>publicClient.readContract({address:d.collection,abi:nftAbi,functionName,args:[account]})));
  referral={bound:bound===zeroAddress?null:bound as Address,invited:BigInt(invited),minted:BigInt(minted),earned:BigInt(earned),rewards:BigInt(rewards)};
  const count=await publicClient.readContract({address:d.collection,abi:nftAbi,functionName:'balanceOf',args:[account]});if(count>7777n)throw Error('持仓数量异常');
  owned.push(...(await chunks(Array.from({length:Number(count)},(_,i)=>BigInt(i)),i=>publicClient.readContract({address:d.collection,abi:nftAbi,functionName:'tokenOfOwnerByIndex',args:[account,i]}))).map(Number));
  const requests=await publicClient.readContract({address:d.collection,abi:nftAbi,functionName:'payerRequestCount',args:[account]});if(requests>7777n)throw Error('请求数量异常');
  for(let offset=0n;offset<requests;offset+=100n){const requestIds=await publicClient.readContract({address:d.collection,abi:nftAbi,functionName:'payerRequests',args:[account,offset,100n]});
   for(const r of await chunks(requestIds,async requestId=>({requestId,data:await publicClient.readContract({address:d.collection,abi:nftAbi,functionName:'requests',args:[requestId]})})))if(!r.data[2]&&r.data[0].toLowerCase()===account.toLowerCase())pending.push({requestId:r.requestId,quantity:Number(r.data[3]),tokenIds:(await publicClient.readContract({address:d.collection,abi:nftAbi,functionName:'requestTokenIds',args:[r.requestId]})).map(Number)});}
 }
 return{referral,total:Number(total),reserved:Number(reserved),owned,pending,listings:rows.filter(x=>x.active||(account&&x.seller.toLowerCase()===account.toLowerCase()&&x.price>0n))};
}
export type ReferralState={bound:Address|null;invited:bigint;minted:bigint;earned:bigint;rewards:bigint};
export type ChainState=Awaited<ReturnType<typeof readState>>;
export const emptyState:ChainState={referral:null,total:0,reserved:0,owned:[],pending:[],listings:[]};
export async function transact(action:'mint'|'claim'|'withdraw'|'approve'|'list'|'cancel'|'buy',account:Address,args:{quantity?:number;referrer?:Address;id?:number;requestId?:bigint;price?:bigint;seller?:Address;version?:bigint},onHash:(hash:Hash)=>void){
 const d=await validateLive(),provider=walletProvider();if(!provider)throw Error('请连接钱包');
 const current=await provider.request({method:'eth_accounts'});if(current[0]?.toLowerCase()!==account.toLowerCase())throw Error('钱包地址已变化，请重新连接');
 if(await provider.request({method:'eth_chainId'})!=='0x38')throw Error('请重新连接并切换至 BNB Chain');
 const client=createWalletClient({chain:bsc,transport:custom(provider),account});
 let request;
 if(action==='mint'){const quote=mintQuote(args.quantity??'');const referrer=validateReferrer(args.referrer||'',account,d.collection);request=await publicClient.simulateContract({address:d.collection,abi:nftAbi,functionName:'requestMint',args:[BigInt(quote.quantity),referrer],account,value:quote.total});}
 else if(action==='withdraw')request=await publicClient.simulateContract({address:d.collection,abi:nftAbi,functionName:'withdrawReferralRewards',args:[account],account});
 else if(action==='claim')request=await publicClient.simulateContract({address:d.collection,abi:nftAbi,functionName:'claim',args:[args.requestId!,account],account});
 else if(action==='approve')request=await publicClient.simulateContract({address:d.collection,abi:nftAbi,functionName:'approve',args:[d.market,BigInt(args.id!)],account});
 else if(action==='list')request=await publicClient.simulateContract({address:d.market,abi:marketAbi,functionName:'list',args:[BigInt(args.id!),args.price!],account});
 else if(action==='cancel')request=await publicClient.simulateContract({address:d.market,abi:marketAbi,functionName:'cancel',args:[BigInt(args.id!)],account});
 else request=await publicClient.simulateContract({address:d.market,abi:marketAbi,functionName:'buy',args:[BigInt(args.id!),args.seller!,args.version!],value:args.price!,account});
 const hash=await client.writeContract(request.request as WriteContractParameters);onHash(hash);
 // Record replacement disposition; never throw inside viem's observer callback.
 let rejectedReplacement=false;
 const receipt=await publicClient.waitForTransactionReceipt({hash,confirmations:2,timeout:180000,onReplaced:({reason})=>{if(reason!=='repriced')rejectedReplacement=true}});
 if(rejectedReplacement)throw Error('交易已取消或替换，原操作未确认');
 if(receipt.transactionHash!==hash){
  // viem can return a replacement after confirmations without invoking onReplaced.
  // Verify the mined transaction against the exact simulated operation as well.
  const replacement=await publicClient.getTransaction({hash:receipt.transactionHash});
  const original=request.request;
  if(replacement.from.toLowerCase()!==account.toLowerCase()||replacement.to?.toLowerCase()!==original.address.toLowerCase()||replacement.value!==('value' in original?original.value??0n:0n)||replacement.input.toLowerCase()!==encodeFunctionData(original as EncodeFunctionDataParameters).toLowerCase())throw Error('交易已取消或替换，原操作未确认');
  onHash(receipt.transactionHash);
 }
 if(receipt.status!=='success')throw Error('链上交易失败，请查看交易记录');return receipt;
}

