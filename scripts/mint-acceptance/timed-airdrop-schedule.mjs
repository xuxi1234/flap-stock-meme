import { requireThat } from './core.mjs';
export const AUTHORIZATION='30x200x0.1:budget0.1:gas0.02';
export function dueAt(j){
 const sends=j.entries.filter(e=>e.kind==='send'&&e.settled&&e.success);
 if(!sends.length)return 0;
 const last=sends.at(-1);requireThat(Number.isSafeInteger(last.confirmedAt)&&last.confirmedAt>0,'上一轮确认时间缺失；必须先核对链上回执。');
 return last.confirmedAt+1200;
}
export const isDue=(j,now)=>Number.isSafeInteger(now)&&now>=dueAt(j);
export function eligible(j,now){
 return j.active===true&&j.authorization===AUTHORIZATION&&j.entries.filter(e=>e.kind==='send'&&e.settled&&e.success).length<30&&isDue(j,now);
}
export function authorize(j,env){
 requireThat(env.GITHUB_ACTIONS==='true'&&env.GITHUB_EVENT_NAME==='workflow_dispatch'&&env.GITHUB_REPOSITORY==='xuxi1234/flap-stock-meme'&&env.GITHUB_REF==='refs/heads/main'&&env.TIMED_CONFIRM==='30x200x0.1','只允许用户在本仓库main手动确认600枚、30轮和累计预算后启动。');
 requireThat(j.entries.filter(e=>e.kind==='send'&&e.settled&&e.success).length<30,'本任务已完成，不能重新开始另一组空投。');
 j.active=true;j.authorization=AUTHORIZATION;j.startedBy=env.GITHUB_ACTOR;j.startedRun=env.GITHUB_RUN_ID;
}
// A mined pending transaction, especially the final round, needs a writable
// reconciliation even when no further distribution is due.
export function shouldWake(j,now){
 return j.active===true&&j.authorization===AUTHORIZATION&&(j.entries.some(e=>!e.settled)||j.entries.filter(e=>e.kind==='send'&&e.settled&&e.success).length===30||isDue(j,now));
}
export const recoveryFingerprint=j=>JSON.stringify([j.active,j.entries.map(e=>[e.hash,e.settled,e.success,e.feeWei,e.confirmedAt])]);
export function readyForExecution(operation,before,j,now){
 return operation==='start'||before!==recoveryFingerprint(j)||eligible(j,now);
}
