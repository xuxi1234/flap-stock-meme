export const ACCOUNT='0x74a7d3198905c3b4ba53574c2dffef3aa4e569aa';
export const TOKEN='0x4b112e1ed0c0cb332d2b39e5dae3bba882f67777';
export const DISTRIBUTOR='0x369890cb7a233be14d33fd4265b26afadce00bc0';
export const AMOUNT=777700000000000000n;
export const PLAN_SHA='22696c8e845abe09dd8d9350bd634eeae5128f827a1cea5a69dbc798a43602e5';
export const EVENT='0x712b3912ee47dab7895999e674cb2c870eaa19adf1459ffa8fd2ae4a78d6c7fc9';
export const word=n=>BigInt(n).toString(16).padStart(64,'0');
export const addr=a=>a.slice(2).toLowerCase().padStart(64,'0');
export function requireOK(v,m){if(!v)throw Error(m);}
export function validate(p){
 requireOK(p.addresses.length===7031&&new Set(p.addresses.map(a=>a.toLowerCase())).size===7031,'名单数量或重复校验失败');
 requireOK(p.addresses.every(a=>/^0x[0-9a-f]{40}$/.test(a)&&![ACCOUNT,DISTRIBUTOR,'0x'+'0'.repeat(40)].includes(a)),'名单格式或分发合约限制校验失败');
 requireOK(p.batchIds.length===36&&new Set(p.batchIds).size===36&&p.batchIds.every(a=>/^0x[0-9a-f]{64}$/.test(a)),'批次标识异常');
 return p;
}
export function group(p,i){requireOK(Number.isInteger(i)&&i>=0&&i<36,'批次无效');return p.addresses.slice(i*200,(i+1)*200);}
export function dataFor(p,i){const a=group(p,i);return '0x8b46a263'+addr(TOKEN)+p.batchIds[i].slice(2)+word(128)+word(128+32*(a.length+1))+word(a.length)+a.map(addr).join('')+word(a.length)+word(AMOUNT).repeat(a.length);}
export function verifyReceipt(p,i,r,head,block){
 requireOK(r&&r.status==='0x1'&&r.from?.toLowerCase()===ACCOUNT&&r.to?.toLowerCase()===DISTRIBUTOR,'交易未成功或不是指定钱包的空投交易');
 requireOK(block&&block.hash?.toLowerCase()===r.blockHash?.toLowerCase(),'回执所在区块未核对通过');
 requireOK(BigInt(head.number)-BigInt(r.blockNumber)>=2n,'等待至少3个区块确认');
 const n=group(p,i).length;
 requireOK(r.logs.some(l=>!l.removed&&l.address.toLowerCase()===DISTRIBUTOR&&l.topics.length===4&&l.topics[0].toLowerCase()===EVENT&&l.topics[1].toLowerCase()==='0x'+addr(ACCOUNT)&&l.topics[2].toLowerCase()===p.batchIds[i]&&l.topics[3].toLowerCase()==='0x'+addr(TOKEN)&&l.data.toLowerCase()==='0x'+word(n)+word(AMOUNT*BigInt(n))),'回执不匹配此任务的地址数量、总量或批次');
 return Number(BigInt(block.timestamp))+3600;
}
