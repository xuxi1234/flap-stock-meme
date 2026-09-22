import {isAddress,zeroAddress,type Address} from 'viem';
export const NFT_SUPPLY=7777;
export const MINT_WEI=10_000_000_000_000_000n;
export const TREASURY='0x764dBCD80ca3E5d50CBAe986e2b6F507Dc47CfcF';
export type CompanyTheme={kind:string;name:string;nameEn?:string;legalName?:string;ticker:string;rank?:number;edition:number;total:number;snapshot:string};
export type NFT={nameEn?:string;familyEn?:string;theme?:CompanyTheme;id:number;name:string;family:string;palette:string;color:string;rarity:string;wing:string;pattern:string;halo:string;dna:string;image:string};
export type Listing={id:number;price:bigint;seller:`0x${string}`;active:boolean;version:bigint};
export function parseBNB(input:string):bigint{
 if(!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,18})?$/.test(input))throw Error('请输入有效的 BNB 价格，最多 18 位小数');
 const [whole,decimal='']=input.split('.');const wei=BigInt(whole)*10n**18n+BigInt(decimal.padEnd(18,'0'));
 if(wei<=0n)throw Error('价格必须大于 0');return wei;
}
export function formatBNB(wei:string|bigint){const n=BigInt(wei);const frac=(n%10n**18n).toString().padStart(18,'0').replace(/0+$/,'');return `${n/10n**18n}${frac?'.'+frac:''}`;}
export function splitFee(price:bigint){return {fee:0n,seller:price};}

export const MAX_BATCH=20;
export const REFERRAL_BPS=2000n;
export function mintQuote(input:string|number){
 const value=String(input);
 if(!/^(?:[1-9]|1\d|20)$/.test(value))throw Error('数量必须为 1–20 的整数');
 const quantity=Number(value),total=MINT_WEI*BigInt(quantity),reward=total*REFERRAL_BPS/10000n;
 return {quantity,total,reward,treasury:total-reward};
}
export function validateReferrer(draft:string,account?:string,collection?:string):Address{
 if(!isAddress(draft))throw Error('请输入有效的邀请地址');
 if([zeroAddress,'0x000000000000000000000000000000000000dead',account,collection].some(a=>a?.toLowerCase()===draft.toLowerCase()))throw Error('邀请地址不能为自己、零地址、销毁地址或 NFT 合约');
 return draft;
}
export function effectiveReferrer(bound:Address|null|undefined,draft:string,account?:string,collection?:string){return validateReferrer(bound||draft,account,collection)}

export function matchesNFT(nft:NFT,query:string,series:string){
 const text=query.trim().toLocaleLowerCase();
 if(/^#?\d+$/.test(text))return (series==='all'||nft.theme?.kind===series)&&nft.id===Number(text.replace('#',''));
 return (series==='all'||nft.theme?.kind===series)&&(!text||String(nft.id)===text.replace(/^#/,'')||[nft.name,nft.nameEn,nft.family,nft.familyEn,nft.palette,nft.theme?.name,nft.theme?.legalName,nft.theme?.ticker].some(value=>value?.toLocaleLowerCase().includes(text)));
}
