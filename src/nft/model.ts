export const NFT_SUPPLY=7777;
export const MINT_WEI=10_000_000_000_000_000n;
export const TREASURY='0x764dBCD80ca3E5d50CBAe986e2b6F507Dc47CfcF';
export type NFT={id:number;name:string;family:string;palette:string;color:string;rarity:string;wing:string;pattern:string;halo:string;dna:string;image:string};
export type Listing={id:number;price:bigint;seller:`0x${string}`;active:boolean;version:bigint};
export function parseBNB(input:string):bigint{
 if(!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,18})?$/.test(input))throw Error('请输入有效的 BNB 价格，最多 18 位小数');
 const [whole,decimal='']=input.split('.');const wei=BigInt(whole)*10n**18n+BigInt(decimal.padEnd(18,'0'));
 if(wei<=0n)throw Error('价格必须大于 0');return wei;
}
export function formatBNB(wei:string|bigint){const n=BigInt(wei);const frac=(n%10n**18n).toString().padStart(18,'0').replace(/0+$/,'');return `${n/10n**18n}${frac?'.'+frac:''}`;}
export function splitFee(price:bigint){return {fee:0n,seller:price};}
