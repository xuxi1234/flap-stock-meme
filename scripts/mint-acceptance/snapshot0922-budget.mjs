import { BUDGET, ACCOUNT } from './snapshot0922-core.mjs';
import { requireThat, equal, reserve } from './snapshot0922-core.mjs';

// This exact public transaction is the ONLY proposed principal exclusion.
// Each manual invocation must explicitly approve it; a saved journal is not approval.
export const OWNED_RETURN=Object.freeze({
 hash:'0x2a78dad3f5f0f72555ef93e3c83b808f5dfdb0bfc6830fc06b8c246b7a9399b6',
 from:'0x79f8b832de72e81ad34fd66ecbbf673613264072',
 to:'0xa7e4b6cd8083efd6de9173021db6fb42b4822914',
 nonce:5,valueWei:'73985542253494651',feeWei:'1050000000000',success:true,data:'0x'
});
export const CHARGED_BASELINE=53882222469141262n;
export const RAW_BASELINE=127867764722635913n;
export const CAMPAIGN_GAS_CAP=null;
export const rawTotal=rows=>rows.reduce((sum,r)=>sum+BigInt(r.feeWei)+(r.success?BigInt(r.valueWei):0n),0n);
export function accountBudget(rows,confirmed=false){
 requireThat(confirmed===true,'请在手动运行入口确认固定7031地址和不设累计Gas预算上限。历史本金与Gas保持单独记账。');
 const matches=rows.filter(r=>equal(r.hash,OWNED_RETURN.hash));
 requireThat(matches.length===1,'自有钱包调拨记录缺失或重复，停止预算调整。');
 const r=matches[0];
 requireThat(Object.entries(OWNED_RETURN).every(([k,v])=>typeof v==='string'?equal(r[k],v):r[k]===v),'自有钱包调拨的链上参数不匹配，停止预算调整。');
 // Keep the original row intact, including its receipt and full gas cost.
 const spent=calculateBudget(rows.map(row=>row===r?{...row,valueWei:'0'}:row));
 const campaignGas=spent-CHARGED_BASELINE;
 requireThat(campaignGas>=0n,'累计Gas账目异常。');
 return {raw:rawTotal(rows),spent,campaignGas,excluded:BigInt(OWNED_RETURN.valueWei)};
}
export function reserveCampaign(spent,gas,price){
 const fee=reserve(spent,gas,price);
 requireThat(spent>=CHARGED_BASELINE,'历史账目基线异常。');
 return fee;
}

function calculateBudget(rows){
 const wallets=new Map(),hashes=new Set();let spent=0n;
 for(const r of rows){
  const from=String(r.from).toLowerCase();
  requireThat([ACCOUNT,OWNED_RETURN.from].some(a=>equal(a,from)),'预算钱包不在固定范围内。');
  requireThat(/^0x[0-9a-fA-F]{64}$/.test(r.hash)&&!hashes.has(r.hash.toLowerCase()),'交易哈希缺失或重复。');hashes.add(r.hash.toLowerCase());
  const nonces=wallets.get(from)||new Set();
  requireThat(Number.isSafeInteger(r.nonce)&&r.nonce>=0&&!nonces.has(r.nonce),'交易nonce无效或重复。');nonces.add(r.nonce);wallets.set(from,nonces);
  requireThat(typeof r.success==='boolean'&&BigInt(r.feeWei)>=0n&&BigInt(r.valueWei)>=0n,'预算记录金额或状态无效。');
  spent+=BigInt(r.feeWei)+(r.success?BigInt(r.valueWei):0n);
 }
 requireThat(wallets.size===2,'历史钱包记录缺失。');
 for(const nonces of wallets.values())for(let n=0;n<nonces.size;n++)requireThat(nonces.has(n),`历史记录缺少nonce ${n}。`);
 return spent;
}
