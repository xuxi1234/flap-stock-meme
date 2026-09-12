import { calculateBudget } from './core.mjs';
import { requireThat, equal, reserve } from './airdrop-core.mjs';

// This exact public transaction is the ONLY proposed principal exclusion.
// Each manual invocation must explicitly approve it; a saved journal is not approval.
export const OWNED_RETURN=Object.freeze({
 hash:'0x2a78dad3f5f0f72555ef93e3c83b808f5dfdb0bfc6830fc06b8c246b7a9399b6',
 from:'0x79f8b832de72e81ad34fd66ecbbf673613264072',
 to:'0xa7e4b6cd8083efd6de9173021db6fb42b4822914',
 nonce:5,valueWei:'73985542253494651',feeWei:'1050000000000',success:true,data:'0x'
});
export const CHARGED_BASELINE=31135627509141262n;
export const RAW_BASELINE=105121169762635913n;
export const CAMPAIGN_GAS_CAP=20000000000000000n;
export const rawTotal=rows=>rows.reduce((sum,r)=>sum+BigInt(r.feeWei)+(r.success?BigInt(r.valueWei):0n),0n);
export function accountBudget(rows,confirmed=false){
 requireThat(confirmed===true,'请在手动运行入口明确确认：仅将已核实的旧钱包转回22914钱包的本金单独记账，Gas仍计入累计0.1 BNB；本次空投Gas最多0.02 BNB。未确认时不执行。');
 const matches=rows.filter(r=>equal(r.hash,OWNED_RETURN.hash));
 requireThat(matches.length===1,'自有钱包调拨记录缺失或重复，停止预算调整。');
 const r=matches[0];
 requireThat(Object.entries(OWNED_RETURN).every(([k,v])=>typeof v==='string'?equal(r[k],v):r[k]===v),'自有钱包调拨的链上参数不匹配，停止预算调整。');
 // Keep the original row intact, including its receipt and full gas cost.
 const spent=calculateBudget(rows.map(row=>row===r?{...row,valueWei:'0'}:row));
 const campaignGas=spent-CHARGED_BASELINE;
 requireThat(campaignGas>=0n&&campaignGas<=CAMPAIGN_GAS_CAP,'本次空投累计Gas超出0.02 BNB，停止；恢复任务不会重置额度。');
 return {raw:rawTotal(rows),spent,campaignGas,excluded:BigInt(OWNED_RETURN.valueWei)};
}
export function reserveCampaign(spent,gas,price){
 const fee=reserve(spent,gas,price);
 requireThat(spent>=CHARGED_BASELINE&&spent-CHARGED_BASELINE+fee<=CAMPAIGN_GAS_CAP,'本次空投累计Gas加本笔最大Gas超过0.02 BNB，停止。');
 return fee;
}
