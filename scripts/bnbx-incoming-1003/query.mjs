import fs from 'node:fs';
import {rpc,hex,mapLimit,safe} from '../holders18/io.mjs';
import {scanRanges} from '../holders18/core.mjs';
const token='0xfd87628840890c9ea4eb3a0053a691b29d3e1111',wallet='0x3485534a9b3a2630febe0708d82d94a63fe9d8bd';
const topic='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
async function main(){
 if(BigInt(await rpc('eth_chainId',[]))!==56n)throw Error('Wrong chain');
 const end=Number(BigInt(await rpc('eth_blockNumber',[])))-30,tag=hex(end);
 const snapshot=await rpc('eth_getBlockByNumber',[tag,false]);
 let lo=0,hi=end;while(lo<hi){const mid=Math.floor((lo+hi)/2);if(await rpc('eth_getCode',[token,hex(mid)])==='0x')lo=mid+1;else hi=mid;}
 const decimals=Number(BigInt(await rpc('eth_call',[{to:token,data:'0x313ce567'},tag])));
 const format=n=>{const s=n.toString().padStart(decimals+1,'0');return decimals?s.slice(0,-decimals)+'.'+s.slice(-decimals):s};
 const starts=Array.from({length:Math.ceil((end-lo+1)/50000)},(_,i)=>lo+i*50000);
 const logs=(await mapLimit(starts,s=>scanRanges(async(a,b)=>{
 const rows=await rpc('eth_getLogs',[{address:token,fromBlock:hex(a),toBlock:hex(b),topics:[topic,null,'0x'+wallet.slice(2).padStart(64,'0')]}]);
 if(rows.length>=10000)throw Object.assign(Error('capped'),{range:true});return rows;
 },s,Math.min(end,s+49999)),6)).flat().sort((a,b)=>Number(BigInt(a.blockNumber)-BigInt(b.blockNumber))||Number(BigInt(a.logIndex)-BigInt(b.logIndex)));
 const blocks=[...new Set(logs.map(x=>x.blockNumber))];const times=new Map(await mapLimit(blocks,async b=>[b,await rpc('eth_getBlockByNumber',[b,false])],6));
 const rows=logs.map(l=>{const b=times.get(l.blockNumber);if(l.removed||b.hash!==l.blockHash||l.address.toLowerCase()!==token||l.topics[2].slice(-40)!==wallet.slice(2))throw Error('Invalid log');
 const timestamp=Number(BigInt(b.timestamp));return {timeBeijing:new Date((timestamp+28800)*1000).toISOString().replace('T',' ').replace('.000Z',' +08:00'),from:'0x'+l.topics[1].slice(-40),to:wallet,amount:format(BigInt(l.data)),raw:BigInt(l.data).toString(),hash:l.transactionHash,block:Number(BigInt(l.blockNumber)),logIndex:Number(BigInt(l.logIndex))};});
 if(new Set(rows.map(r=>r.hash+':'+r.logIndex)).size!==rows.length)throw Error('Duplicate log');
 if((await rpc('eth_getBlockByNumber',[tag,false])).hash!==snapshot.hash)throw Error('Reorg');
 const balance=BigInt(await rpc('eth_call',[{to:token,data:'0x70a08231'+wallet.slice(2).padStart(64,'0')},tag]));
 const result={token,wallet,decimals,creationBlock:lo,snapshotBlock:end,snapshotTime:new Date(Number(BigInt(snapshot.timestamp))*1000).toISOString(),count:rows.length,total:format(rows.reduce((s,r)=>s+BigInt(r.raw),0n)),balance:format(balance),rows};
 fs.mkdirSync('bnbx-incoming-output',{recursive:true});fs.writeFileSync('bnbx-incoming-output/result.json',JSON.stringify(result,null,2));
 fs.writeFileSync('bnbx-incoming-output/incoming.csv','\ufeff北京时间,发送地址,接收地址,BNBX数量,交易哈希,区块,日志序号\r\n'+rows.map(r=>[r.timeBeijing,r.from,r.to,r.amount,r.hash,r.block,r.logIndex].join(',')).join('\r\n')+'\r\n');
 console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(safe(e));process.exitCode=1});
