import { requireThat, BATCHES } from './snapshot0922-core.mjs';
export const AUTHORIZATION='snapshot0922x0.7777:200:3600seconds:gas-unlimited';
export function dueAt(j){
 const sends=j.entries.filter(e=>e.kind==='send'&&e.settled&&e.success);
 if(!sends.length)return 0;
 const last=sends.at(-1);requireThat(Number.isSafeInteger(last.confirmedAt)&&last.confirmedAt>0,'上一轮确认时间缺失；必须先核对链上回执。');
 return last.confirmedAt+3600;
}
export const isDue=(j,now)=>Number.isSafeInteger(now)&&now>=dueAt(j);
export function eligible(j,now){
 return j.active===true&&j.authorization===AUTHORIZATION&&j.entries.filter(e=>e.kind==='send'&&e.settled&&e.success).length<BATCHES&&isDue(j,now);
}
export function authorize(j,env){
 requireThat(env.GITHUB_ACTIONS==='true'&&env.GITHUB_EVENT_NAME==='workflow_dispatch'&&env.GITHUB_REPOSITORY==='xuxi1234/flap-stock-meme'&&env.GITHUB_REF==='refs/heads/main'&&env.SNAPSHOT0922_CONFIRM==='snapshot0922x0.7777:200:3600seconds:gas-unlimited','只允许用户在本仓库main手动确认固定名单、每批200地址、每60分钟一批和不限累计Gas预算后启动。');
 requireThat(j.entries.filter(e=>e.kind==='send'&&e.settled&&e.success).length<BATCHES,'本任务已完成，不能重新开始另一组空投。');
 requireThat(!(j.active===false&&j.startedRun&&j.startedRun===env.GITHUB_RUN_ID),'本次队列已暂停，禁止后续步骤自动重新启动；需要新的手动运行。');
 j.active=true;j.authorization=AUTHORIZATION;j.startedBy=env.GITHUB_ACTOR;j.startedRun=env.GITHUB_RUN_ID;
}
// A mined pending transaction, especially the final round, needs a writable
// reconciliation even when no further distribution is due.
export function shouldWake(j,now){
 return j.active===true&&j.authorization===AUTHORIZATION&&(j.entries.some(e=>!e.settled)||j.entries.filter(e=>e.kind==='send'&&e.settled&&e.success).length===BATCHES||isDue(j,now));
}
export const recoveryFingerprint=j=>JSON.stringify([j.active,j.entries.map(e=>[e.hash,e.settled,e.success,e.feeWei,e.confirmedAt])]);
export function readyForExecution(operation,before,j,now){
 return operation==='start'||before!==recoveryFingerprint(j)||eligible(j,now);
}
