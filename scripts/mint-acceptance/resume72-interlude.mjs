import fs from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { requireThat,equal } from './core.mjs';

// One explicitly reviewed interruption, not an arbitrary nonce-gap allowance.
export const CSV_CHECKPOINT='48b9be9f832ae2d1de9eee0c90c4151a2e580e9f';
export const PRIOR=JSON.parse(fs.readFileSync(new URL('./data/resume72-prior.json',import.meta.url),'utf8'));
export const CSV=JSON.parse(fs.readFileSync(new URL('./data/resume72-csv600-completed.json',import.meta.url),'utf8'));
const entries=j=>j.entries.map(({received,...e})=>{const {data,...transaction}=e.transaction;return {...e,transaction};});
export function assertResumePrefix(j){
 requireThat(j.resumeAfterCsv600===CSV_CHECKPOINT,'未确认表格任务的固定检查点。');
 requireThat(Array.isArray(j.entries)&&j.entries.length>=29&&isDeepStrictEqual(entries(j).slice(0,29),PRIOR.entries),'原72轮的27轮已完成记录发生变化，禁止续跑。');
}
export function assertCsvComplete(j){
 requireThat(j.version===CSV.version&&j.id===CSV.id&&j.account===CSV.account&&j.token===CSV.token&&j.distributor===CSV.distributor&&j.active===false&&isDeepStrictEqual(entries(j),CSV.entries),'表格600地址任务未完成或记录已变化，禁止续跑。');
}
export function prepareResume(j,csv){
 assertCsvComplete(csv);
 requireThat([2,3].includes(j.version)||(j.version===1&&j.entries.length===29),'只能迁移已核实27轮的原任务。');
 const updated={...j,version:j.version===3?3:2,resumeAfterCsv600:CSV_CHECKPOINT};assertResumePrefix(updated);
 return updated;
}

export async function csvInterludeRows(clients){
 // Dynamic imports avoid an initialization cycle: the CSV verifier also uses
 // the original 72-round verifier for its own historical baseline.
 const {hydrate}=await import('./csv600-store.mjs');
 const {verifiedRow,verifyDelivery,verifyMappings}=await import('./csv600-run.mjs');
 const j=hydrate(structuredClone(CSV));assertCsvComplete(j);
 const rows=await Promise.all(j.entries.map(async e=>{
  const row=await verifiedRow(clients,e.hash),t=e.transaction;
  requireThat(row&&equal(row.from,j.account)&&row.nonce===t.nonce&&equal(row.to,t.to)&&equal(row.data,t.data)&&row.valueWei==='0'&&row.gas===t.gas&&row.gasPrice===t.gasPrice&&row.success===true&&row.feeWei===e.feeWei&&row.confirmedAt===e.confirmedAt,'表格空投回执与固定快照不符，停止续跑。');
  verifyDelivery(e,row.logs);return row;
 }));
 await verifyMappings(clients,j);
 // Budget is calculated by the caller after adding the original 27 rounds,
 // so nonce43..71 and all CSV Gas are present exactly once.
 return rows;
}

export function assertCsvRows(rows){
 for(const e of CSV.entries){
  const matches=rows.filter(r=>r.hash===e.hash);
  requireThat(matches.length===1&&matches[0].nonce===e.transaction.nonce&&matches[0].feeWei===e.feeWei&&matches[0].valueWei==='0'&&matches[0].success===true,'表格任务的实际Gas缺失或重复，禁止低估累计预算。');
 }
}
