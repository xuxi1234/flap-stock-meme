import {useState} from 'react';
import type {NFT} from '../model';
import {useLanguage} from '../i18n';
export function drawExperience(catalog:NFT[],quantity:number){
 if(!Number.isInteger(quantity)||quantity<1||quantity>20||quantity>catalog.length)throw Error('数量必须为 1–20 的整数');
 const pool=[...catalog];
 for(let i=0;i<quantity;i++){
  const bound=pool.length-i,limit=Math.floor(0x100000000/bound)*bound,buffer=new Uint32Array(1);let value;
  do{crypto.getRandomValues(buffer);value=buffer[0]}while(value>=limit);
  const j=i+value%bound;[pool[i],pool[j]]=[pool[j],pool[i]];
 }
 return pool.slice(0,quantity);
}
export function FreeOpen({catalog,favorites=[],onFavorite}:{catalog:NFT[];favorites?:number[];onFavorite?:(id:number)=>void}){
 const {render}=useLanguage();const [quantity,setQuantity]=useState('1'),[result,setResult]=useState<NFT[]>([]);
 const n=Number(quantity),valid=/^(?:[1-9]|1\d|20)$/.test(quantity)&&catalog.length>=n;
 return render(<><div className="nft-eyebrow">FREE EXPERIENCE</div><h2>免费开蝶</h2><p className="nft-dialog-copy">免费体验 · 非链上 NFT</p><p className="nft-dialog-copy">不扣 BNB、不连接钱包、不占用发行额度。体验结果不能转账或挂单。</p><label className="nft-price-label">体验数量<input aria-label="体验数量" inputMode="numeric" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label><div className="nft-presets">{[1,5,10,20].map(v=><button key={v} onClick={()=>setQuantity(String(v))}>{v} 张</button>)}</div><button className="nft-btn primary full" disabled={!valid} onClick={()=>setResult(drawExperience(catalog,n))}>{result.length?'再开一次':'随机开出'} ↗</button><p className="nft-dialog-copy">本次体验内不重复；再次体验可能开出相同编号。</p>{result.length>0&&<section aria-label="体验结果" aria-live="polite"><h3>体验结果 · {result.length}</h3><div className="nft-reveal">{result.map(nft=><figure key={nft.id}><img src={nft.image} alt={nft.name}/><figcaption><strong>#{nft.id} · {nft.theme?.name||nft.family}</strong><small>{nft.family}</small>{onFavorite&&<button className="nft-result-save" aria-label={`${favorites.includes(nft.id)?'移出心愿单':'加入心愿单'} #${nft.id}`} aria-pressed={favorites.includes(nft.id)} onClick={()=>onFavorite(nft.id)}>{favorites.includes(nft.id)?'♥ 已加入心愿单':'♡ 加入心愿单'}</button>}</figcaption></figure>)}</div></section>}</>);
}
