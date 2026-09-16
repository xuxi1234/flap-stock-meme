export const NFT_SUPPLY=7777;
export const MINT_WEI=10_000_000_000_000_000n;
export const TREASURY='0x764dBCD80ca3E5d50CBAe986e2b6F507Dc47CfcF';
export const STORAGE_KEY='butterfly-7777-preview-v1';
export type NFT={id:number;name:string;family:string;palette:string;color:string;rarity:string;wing:string;pattern:string;halo:string;dna:string;image:string};
export type Listing={id:number;price:string;seller:'you'|'demo';};
export type Activity={id:string;kind:'mint'|'list'|'cancel'|'buy';token:number;price:string;fee:string;time:number;};
export type Ledger={version:1;owned:number[];minted:number[];listings:Listing[];activity:Activity[]};
export const DEMO_IDS=[17,77,128,256,777,1314,2048,4096];
export function initialLedger():Ledger{return {version:1,owned:[],minted:[],listings:DEMO_IDS.map((id,i)=>({id,price:(BigInt(12+i*3)*10n**15n).toString(),seller:'demo'})),activity:[]};}
export function parseBNB(input:string):bigint{
 if(!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,18})?$/.test(input))throw Error('请输入有效的 BNB 价格，最多 18 位小数');
 const [whole,decimal='']=input.split('.');const wei=BigInt(whole)*10n**18n+BigInt(decimal.padEnd(18,'0'));
 if(wei<=0n)throw Error('价格必须大于 0');return wei;
}
export function formatBNB(wei:string|bigint){const n=BigInt(wei);const frac=(n%10n**18n).toString().padStart(18,'0').replace(/0+$/,'');return `${n/10n**18n}${frac?'.'+frac:''}`;}
export function splitFee(price:bigint){const fee=price*700n/10000n;return {fee,seller:price-fee};}
export function drawRandom(ledger:Ledger,random:(a:Uint32Array<ArrayBuffer>)=>Uint32Array<ArrayBuffer>=a=>crypto.getRandomValues(a)){
 const unavailable=new Set([...DEMO_IDS,...ledger.minted,...ledger.owned]);
 const available=Array.from({length:NFT_SUPPLY},(_,i)=>i+1).filter(id=>!unavailable.has(id));
 if(!available.length)throw Error('此体验收藏已全部领取');
 const limit=Math.floor(4294967296/available.length)*available.length;let word:number;
 do {word=random(new Uint32Array(1))[0];}while(word>=limit);
 return available[word%available.length];
}
function validId(id:number){if(!Number.isInteger(id)||id<1||id>NFT_SUPPLY)throw Error('无效的 NFT 编号');}
function addActivity(state:Ledger,kind:Activity['kind'],token:number,price:bigint,fee=0n):Ledger{
 return {...state,activity:[{id:crypto.randomUUID(),kind,token,price:price.toString(),fee:fee.toString(),time:Date.now()},...state.activity].slice(0,200)};
}
export function mint(state:Ledger,id:number){validId(id);if(DEMO_IDS.includes(id)||state.minted.includes(id)||state.owned.includes(id))throw Error('该编号已经被领取');return addActivity({...state,owned:[...state.owned,id],minted:[...state.minted,id]},'mint',id,MINT_WEI);}
export function list(state:Ledger,id:number,price:bigint){validId(id);if(!state.owned.includes(id))throw Error('你尚未持有这张 NFT');if(state.listings.some(x=>x.id===id))throw Error('这张 NFT 已在挂单中');if(price<=0n)throw Error('价格必须大于 0');return addActivity({...state,listings:[...state.listings,{id,price:price.toString(),seller:'you'}]},'list',id,price);}
export function cancel(state:Ledger,id:number){const l=state.listings.find(x=>x.id===id);if(!l||l.seller!=='you')throw Error('只能撤销自己的挂单');return addActivity({...state,listings:state.listings.filter(x=>x.id!==id)},'cancel',id,BigInt(l.price));}
export function buy(state:Ledger,id:number,expectedPrice:string){const l=state.listings.find(x=>x.id===id);if(!l)throw Error('挂单已失效');if(l.seller==='you'||state.owned.includes(id))throw Error('不能购买自己的 NFT');if(l.price!==expectedPrice)throw Error('价格发生变化，请重新确认');return addActivity({...state,owned:[...state.owned,id],listings:state.listings.filter(x=>x.id!==id)},'buy',id,BigInt(l.price),splitFee(BigInt(l.price)).fee);}
export function loadLedger():Ledger{
 try{
  const x:unknown=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
  if(!x||typeof x!=='object')return initialLedger();
  const ledger=x as Partial<Ledger>;
  if(ledger.version!==1||!Array.isArray(ledger.owned)||!Array.isArray(ledger.minted)||!Array.isArray(ledger.listings)||!Array.isArray(ledger.activity))return initialLedger();
  const ids=[...ledger.owned,...ledger.minted];
  if(ids.some(id=>typeof id!=='number'||!Number.isInteger(id)||id<1||id>NFT_SUPPLY)||new Set(ledger.owned).size!==ledger.owned.length||new Set(ledger.minted).size!==ledger.minted.length)return initialLedger();
  const owned=new Set(ledger.owned),minted=new Set(ledger.minted);
  if(ledger.minted.some(id=>!owned.has(id)||DEMO_IDS.includes(id)))return initialLedger();
  if(ledger.listings.some(l=>!l||typeof l!=='object'||!Number.isInteger(l.id)||l.id<1||l.id>NFT_SUPPLY||!['you','demo'].includes(l.seller)||typeof l.price!=='string'||!/^\d+$/.test(l.price)||BigInt(l.price)<=0n))return initialLedger();
  if(new Set(ledger.listings.map(l=>l.id)).size!==ledger.listings.length)return initialLedger();
  if(ledger.listings.some(l=>l.seller==='you'?!owned.has(l.id):!DEMO_IDS.includes(l.id)||owned.has(l.id)||minted.has(l.id)))return initialLedger();
  const kinds=new Set<Activity['kind']>(['mint','list','cancel','buy']);
  if(ledger.activity.some(a=>!a||typeof a!=='object'||typeof a.id!=='string'||!a.id||!kinds.has(a.kind)||!Number.isInteger(a.token)||a.token<1||a.token>NFT_SUPPLY||typeof a.price!=='string'||!/^\d+$/.test(a.price)||typeof a.fee!=='string'||!/^\d+$/.test(a.fee)||typeof a.time!=='number'||!Number.isFinite(a.time)||a.time<0))return initialLedger();
  if(new Set(ledger.activity.map(a=>a.id)).size!==ledger.activity.length)return initialLedger();
  return ledger as Ledger;
 }catch{return initialLedger();}
}
