import {useLanguage} from '../i18n';
import {useEffect,useState} from 'react';
import {zeroAddress,type Address} from 'viem';
import {mintQuote,effectiveReferrer,formatBNB} from '../model';
import type {ReferralState} from '../chain';
export function loadReferralDraft(){try{return new URLSearchParams(location.search).get('ref')??localStorage.getItem('butterfly-referral-draft')??''}catch{return ''}}
export function MintForm({quantity,setQuantity,draft,setDraft,wallet,referral,collection,live,busy,reserved,optionalReferrer=false,onConnect,onMint}:{quantity:string;setQuantity:(v:string)=>void;draft:string;setDraft:(v:string)=>void;wallet?:Address;referral:ReferralState|null;collection:string;live:boolean;busy:boolean;reserved:number;optionalReferrer?:boolean;onConnect:()=>void;onMint:(quantity:number,referrer:Address)=>void}){
 const {render}=useLanguage();
 const [ack,setAck]=useState(false);
 useEffect(()=>setAck(false),[wallet,draft,referral?.bound]);
 useEffect(()=>{try{localStorage.setItem('butterfly-referral-draft',draft)}catch{/* storage is optional */}},[draft]);
 let quote:ReturnType<typeof mintQuote>|undefined,referrer:Address|undefined,issue='';
 try{referrer=effectiveReferrer(referral?.bound,draft,wallet,collection,optionalReferrer);quote=mintQuote(quantity,referrer!==zeroAddress)}catch(e){issue=(e as Error).message}
 const bound=referral?.bound&&referral.bound!==zeroAddress?referral.bound:null;
 const hasReferrer=!!referrer&&referrer!==zeroAddress;
 return render(<><div className="nft-eyebrow">A BATCH OF DISCOVERY / 01–20</div><h2>让色彩，一起抵达。</h2><p className="nft-dialog-copy">每张 0.01 BNB · 一次申请，整批领取 · 市场手续费 0%</p>
 <p className="nft-disclaimer">随机铸造从当前可用编号中分配，不能指定编号。</p>
 <label className="nft-price-label" htmlFor="mint-quantity">铸造数量</label><div className="nft-stepper"><button aria-label="减少数量" disabled={busy||!quote||quote.quantity<=1} onClick={()=>setQuantity(String(Number(quantity)-1))}>−</button><input id="mint-quantity" aria-label="铸造数量" inputMode="numeric" value={quantity} disabled={busy} onChange={e=>setQuantity(e.target.value)}/><button aria-label="增加数量" disabled={busy||!quote||quote.quantity>=20} onClick={()=>setQuantity(String(Number(quantity)+1))}>＋</button></div><div className="nft-presets">{[1,5,10,20].map(n=><button disabled={busy} className={quantity===String(n)?'active':''} key={n} onClick={()=>setQuantity(String(n))}>{n} 张</button>)}</div>
 <div className="nft-binding"><strong>{bound?'链上已绑定 · 永久不可更改':optionalReferrer?'邀请人（选填）':'首次绑定邀请人'}</strong>{bound?<code data-testid="bound-referrer">{bound}</code>:<><label htmlFor="mint-referrer">邀请地址（链接仅提供草稿）</label><input id="mint-referrer" aria-label="邀请地址" placeholder="0x…" disabled={busy} value={draft} onChange={e=>setDraft(e.target.value.trim())}/><small>{optionalReferrer?'没有邀请人可直接铸造，全部铸造款进入收款地址。有邀请人时奖励 20%，首次绑定后不可更改。':'无默认邀请人。连接钱包后重新核对，成功上链才会永久绑定。'}</small>{optionalReferrer&&draft&&<button type="button" disabled={busy} onClick={()=>setDraft('')}>不使用邀请人</button>}{hasReferrer&&<label className="nft-ack"><input type="checkbox" checked={ack} disabled={busy} onChange={e=>setAck(e.target.checked)}/>我确认该邀请人；首次交易成功后不可更改。</label>}</>}</div>
 <div className="nft-receipt" aria-live="polite"><div><span>本次支付</span><strong>{quote?formatBNB(quote.total):'—'} BNB</strong></div><div><span>{hasReferrer?'邀请人奖励 · 20%':'邀请人奖励 · 0%'}</span><strong>{quote?formatBNB(quote.reward):'—'} BNB</strong></div><div><span>{hasReferrer?'铸造收款地址 · 80%':'铸造收款地址 · 100%'}</span><strong>{quote?formatBNB(quote.treasury):'—'} BNB</strong></div></div>
 <p className="nft-disclaimer">仅一代邀请奖励，在整批领取成功后记入邀请人可提现余额。申请、分配和领取均需链上确认，网络 Gas 另计。等待随机数时请勿重复付款；申请不能取消或退款。</p>{issue&&<p className="nft-form-error" role="status">{issue}</p>}{live&&<p>剩余可申请 {7777-reserved} 张</p>}
 {!wallet&&<button className="nft-btn secondary full" disabled={busy} onClick={onConnect}>连接钱包并保留草稿 ↗</button>}
 <button className="nft-btn primary full" disabled={!live||busy||!wallet||!referral||!quote||!referrer||(!bound&&hasReferrer&&!ack)||!!quote&&reserved+quote.quantity>7777} onClick={()=>quote&&referrer&&onMint(quote.quantity,referrer)}>{!live?'尚未开放付款':busy?'等待钱包 / 链上确认…':`支付 ${quote?formatBNB(quote.total):'—'} BNB · 批量铸造 ↗`}</button></>);
}
