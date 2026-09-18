import {useLanguage} from '../i18n';
import {useState} from 'react';
import type {Address} from 'viem';
import type {ReferralState} from '../chain';
import {formatBNB} from '../model';
export function ReferralPanel({wallet,referral,live,busy,onWithdraw}:{wallet?:Address;referral:ReferralState|null;live:boolean;busy:boolean;onWithdraw:()=>void}){
 const {render}=useLanguage();
 const [message,setMessage]=useState('');const available=!!wallet&&live&&!!referral;
 async function copy(){if(!wallet)return;try{const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('ref',wallet);await navigator.clipboard.writeText(url.toString());setMessage('邀请链接已复制')}catch{setMessage('复制失败，请使用下方地址手动创建 ?ref= 邀请链接')}}
 return render(<section className="nft-referral" aria-label="邀请奖励"><div><div className="nft-eyebrow">SHARE THE COLOUR</div><h2>把相遇，分享出去。</h2><p>一代邀请 · 铸造款的 20% · 二级市场无邀请奖励</p><button className="nft-btn secondary" disabled={!wallet} onClick={()=>void copy()}>复制我的邀请链接 ↗</button>{wallet&&<code>{wallet}</code>}{message&&<p role="status">{message}</p>}</div><div><div className="nft-referral-stats">{[['已绑定邀请人数',available?referral.invited.toString():'暂不可用'],['成功领取张数',available?referral.minted.toString():'暂不可用'],['累计奖励 BNB',available?formatBNB(referral.earned):'暂不可用'],['可提现 BNB',available?formatBNB(referral.rewards):'暂不可用']].map(([label,value])=><div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div><button className="nft-btn primary full" disabled={!available||busy||!referral||referral.rewards<=0n} onClick={onWithdraw}>提现奖励到当前钱包 ↗</button><small>仅展示链上数据。提现另需网络 Gas。</small></div></section>);
}
