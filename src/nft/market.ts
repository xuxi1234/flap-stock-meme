import {type NFT,type Listing,parseBNB} from './model';
export type Sort='id-asc'|'id-desc'|'price-asc'|'price-desc';
export function priceRange(min:string,max:string){
 const parse=(s:string)=>!s.trim()?undefined:/^0(?:\.0{1,18})?$/.test(s.trim())?0n:parseBNB(s.trim());
 try{const low=parse(min),high=parse(max);if(low!==undefined&&high!==undefined&&low>high)return {error:'最低价不能高于最高价'};return{low,high,error:''}}catch{return{error:'请输入有效价格，最多 18 位小数'}}
}
export function selectMarketItems(items:NFT[],listings:Map<number,Listing>,sort:Sort,min='',max=''){
 const range=priceRange(min,max);if(range.error)return [];
 const result=items.filter(nft=>{if(range.low===undefined&&range.high===undefined)return true;const l=listings.get(nft.id);return !!l?.active&&(range.low===undefined||l.price>=range.low)&&(range.high===undefined||l.price<=range.high)});
 return result.sort((a,b)=>{if(sort.startsWith('price')){const x=listings.get(a.id),y=listings.get(b.id);if(!x?.active)return y?.active?1:a.id-b.id;if(!y?.active)return -1;if(x.price!==y.price)return (x.price<y.price?-1:1)*(sort==='price-desc'?-1:1)}return sort==='id-desc'?b.id-a.id:a.id-b.id});
}
export function marketStats(listings:Listing[]){const active=listings.filter(l=>l.active);return{count:active.length,sellers:new Set(active.map(l=>l.seller.toLowerCase())).size,floor:active.length?active.reduce((v,l)=>l.price<v?l.price:v,active[0].price):null}}
export function readFavorites(value:string|null):number[]{try{const ids=JSON.parse(value||'[]');return Array.isArray(ids)?[...new Set(ids.filter((id:unknown)=>typeof id==='number'&&Number.isInteger(id)&&id>=1&&id<=7777))]:[]}catch{return []}}
