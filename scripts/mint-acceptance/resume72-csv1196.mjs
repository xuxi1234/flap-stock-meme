import fs from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {requireThat,equal} from './core.mjs';
export const PRIOR39=JSON.parse(fs.readFileSync(new URL('./data/resume72-before-csv1196.json',import.meta.url),'utf8'));
export const CSV1196=JSON.parse(fs.readFileSync(new URL('./data/resume72-csv1196-completed.json',import.meta.url),'utf8'));
export const CSV1196_CHECKPOINT=CSV1196.entries.at(-1).hash;
const entries=j=>j.entries.map(({received,...e})=>{const {data,...transaction}=e.transaction;return {...e,transaction};});
export function assertCsv1196Prefix(j){
 requireThat(j.resumeAfterCsv1196===CSV1196_CHECKPOINT,'未确认1196地址任务的固定检查点。');
 requireThat(Array.isArray(j.entries)&&j.entries.length>=42&&isDeepStrictEqual(entries(j).slice(0,42),PRIOR39.entries),'原72轮的39轮已完成记录发生变化，禁止续跑。');
}
export function assertCsv1196Complete(j){
 requireThat(j.version===CSV1196.version&&j.id===CSV1196.id&&j.account===CSV1196.account&&j.token===CSV1196.token&&j.distributor===CSV1196.distributor&&j.active===false&&isDeepStrictEqual(entries(j),CSV1196.entries),'1196地址任务未完成或记录已变化，禁止续跑。');
}
export function prepareResume1196(j,csv){
 assertCsv1196Complete(csv);
 requireThat(j.version===3||(j.version===2&&j.entries.length===42),'只能迁移已核实39轮的原任务。');
 const updated={...j,version:3,resumeAfterCsv1196:CSV1196_CHECKPOINT};assertCsv1196Prefix(updated);return updated;
}
export async function csv1196InterludeRows(clients){
 // Reconstruct exactly the eight transactions between nonce90 and nonce97.
 const {setPrior}=await import('./csv1196-core.mjs');setPrior(PRIOR39);
 const {hydrate}=await import('./csv1196-store.mjs');
 const {verifiedRow,verifyDelivery,verifyMappings}=await import('./csv1196-run.mjs');
 const j=hydrate(structuredClone(CSV1196));assertCsv1196Complete(j);
 const rows=await Promise.all(j.entries.map(async e=>{
  const row=await verifiedRow(clients,e.hash),t=e.transaction;
  requireThat(row&&equal(row.from,j.account)&&row.nonce===t.nonce&&equal(row.to,t.to)&&equal(row.data,t.data)&&row.valueWei==='0'&&row.gas===t.gas&&row.gasPrice===t.gasPrice&&row.success===true&&row.feeWei===e.feeWei&&row.confirmedAt===e.confirmedAt,'1196地址空投回执与固定快照不符，停止续跑。');
  verifyDelivery(e,row.logs);return row;
 }));
 await verifyMappings(clients,j);return rows;
}
export function assertCsv1196Rows(rows){
 for(const e of CSV1196.entries){
  const matches=rows.filter(r=>r.hash===e.hash);
  requireThat(matches.length===1&&matches[0].nonce===e.transaction.nonce&&matches[0].feeWei===e.feeWei&&matches[0].valueWei==='0'&&matches[0].success===true,'1196地址任务的实际Gas缺失或重复，禁止低估累计预算。');
 }
}
