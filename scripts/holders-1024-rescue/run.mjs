import fs from 'node:fs';
import {rpc,hex,mapLimit,digest,safe} from '../holders18/io1024.mjs';
import {candidates,scanRanges,selectTop,proveTopCoverage} from '../holders18/core.mjs';
import {verifyMulticall,readBalances} from '../holders18/multicall.mjs';
const token='0xc9882def23bc42d53895b8361d0b1edc7570bc6a',mode=process.argv[2];
const base=JSON.parse(fs.readFileSync('holder-input/0x4b112e1ed0c0cb332d2b39e5dae3bba882f67777.json'));
const block=base.snapshotBlock,tag=hex(block),hash=base.snapshotHash;
fs.mkdirSync('rescue-output',{recursive:true});
if((await rpc('eth_getBlockByNumber',[tag,false])).hash!==hash)throw Error('Snapshot mismatch');
let lo=0,hi=block;while(lo<hi){const mid=Math.floor((lo+hi)/2);if(await rpc('eth_getCode',[token,hex(mid)])==='0x')lo=mid+1;else hi=mid;}
const creation=lo;
if(mode==='scan'){
 const shard=Number(process.env.SHARD),width=Math.ceil((block-creation+1)/12),from=creation+shard*width,to=Math.min(block,from+width-1);
 const ranges=[],set=new Set();let logs=0;
 const starts=Array.from({length:Math.ceil((to-from+1)/10000)},(_,i)=>from+i*10000);
 await mapLimit(starts,async start=>{
  await scanRanges(async(a,b)=>{
   const rows=await rpc('eth_getLogs',[{address:token,fromBlock:hex(a),toBlock:hex(b),topics:['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef']}]);
   if(rows.length>=10000)throw Object.assign(Error('Potential capped range'),{range:true});
   for(const l of rows)if(l.address.toLowerCase()!==token||Number(BigInt(l.blockNumber))<a||Number(BigInt(l.blockNumber))>b)throw Error('Bad log');
   for(const address of candidates(rows))set.add(address);
   ranges.push({from:a,to:b,count:rows.length,sha256:digest(rows)});logs+=rows.length;
   return [];
  },start,Math.min(to,start+9999));
  if(starts.indexOf(start)%20===0)console.log('PROGRESS',shard,start,to,'candidates',set.size);
 },4);
 fs.writeFileSync(`rescue-output/shard-${shard}.json`,JSON.stringify({token,block,hash,creation,from,to,ranges:ranges.sort((a,b)=>a.from-b.from),addresses:[...set],logs}));
 console.log('SHARD_DONE',shard,set.size);
}else{
 const set=new Set(),ranges=[];let logCount=0;
 for(let i=0;i<12;i++){const s=JSON.parse(fs.readFileSync(`rescue-input/shard-${i}.json`));if(s.block!==block||s.hash!==hash||s.token!==token||s.creation!==creation)throw Error('Shard mismatch');for(const a of s.addresses)set.add(a);ranges.push(...s.ranges);logCount+=s.logs;}
 ranges.sort((a,b)=>a.from-b.from);let next=creation;for(const r of ranges){if(r.from!==next||r.to<r.from)throw Error('Coverage gap');next=r.to+1;}if(next!==block+1)throw Error('Coverage end mismatch');
 const addresses=[...set].sort(),groups=Array.from({length:Math.ceil(addresses.length/100)},(_,i)=>addresses.slice(i*100,i*100+100));
 await verifyMulticall(rpc,tag);
 const balances=(await mapLimit(groups,async(g,i)=>{const values=await readBalances(g,rpc,token,tag);for(const n of new Set([0,g.length-1])){const direct=BigInt(await rpc('eth_call',[{to:token,data:'0x70a08231'+g[n].slice(2).padStart(64,'0')},tag]));if(direct!==BigInt(values[n]))throw Error('Balance mismatch');}if(i%100===0)console.log('BALANCES',i*100,addresses.length);return g.map((address,n)=>({address,balance:BigInt(values[n]).toString()}));},4)).flat();
 const supply=BigInt(await rpc('eth_call',[{to:token,data:'0x18160ddd'},tag])),sum=balances.reduce((s,r)=>s+BigInt(r.balance),0n),top=selectTop(balances,1000);
 const result={token,symbol:'FIST',creationBlock:creation,snapshotBlock:block,snapshotHash:hash,totalSupply:String(supply),verifiedBalanceSum:String(sum),...proveTopCoverage(sum,supply,top,1000),positiveHolders:balances.filter(x=>BigInt(x.balance)>0n).length,logCount,ranges,top};
 fs.writeFileSync(`holder-input/${token}.json`,JSON.stringify(result));
 console.log('TOKEN_DONE',result.positiveHolders,top.length);fs.appendFileSync(process.env.GITHUB_ENV,`HOLDERS_SNAPSHOT=${block}\nHOLDERS_SNAPSHOT_HASH=${hash}\n`);
}
