import fs from 'node:fs';
const address='0x74a7d3198905c3b4ba53574c2dffef3aa4e569aa';
const lastHash='0x8a1ca8d4be9a0cf0da1c59f5a9c7c2c6e3e19a887c551fc9c4e2b5220aa8c074';
async function rpc(method,params){
 for(let i=0;i<4;i++){
  try {const r=await fetch(process.env.FLAP_BSC_RPC_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(30000)});
   const d=await r.json();if(r.ok&&!d.error)return d.result;
  }catch{}
 }
 throw new Error('RPC read failed: '+method);
}
async function main(){
 if(!process.env.FLAP_BSC_RPC_URL)throw new Error('Missing configured RPC');
 if(await rpc('eth_chainId',[])!=='0x38')throw new Error('Wrong chain');
 const last=await rpc('eth_getTransactionReceipt',[lastHash]);
 if(!last)throw new Error('Missing checkpoint receipt');
 const tip=await rpc('eth_getBlockByNumber',['latest',false]);
 const count=Number(BigInt(await rpc('eth_getTransactionCount',[address,tip.number])));
 const pending=Number(BigInt(await rpc('eth_getTransactionCount',[address,'pending'])));
 if(count<275||count>325)throw new Error('Unexpected nonce range');
 const rows=[];
 for(let nonce=275;nonce<count;nonce++){
  let lo=Number(BigInt(last.blockNumber)),hi=Number(BigInt(tip.number));
  while(lo<hi){const mid=Math.floor((lo+hi)/2);const n=Number(BigInt(await rpc('eth_getTransactionCount',[address,'0x'+mid.toString(16)])));if(n>nonce)hi=mid;else lo=mid+1;}
  const block=await rpc('eth_getBlockByNumber',['0x'+lo.toString(16),true]);
  const tx=block.transactions.find(t=>t.from.toLowerCase()===address&&Number(BigInt(t.nonce))===nonce);
  if(!tx)throw new Error('Transaction not located for nonce '+nonce);
  const receipt=await rpc('eth_getTransactionReceipt',[tx.hash]);
  if(!receipt||receipt.blockHash!==block.hash)throw new Error('Receipt mismatch');
  const row={nonce,hash:tx.hash,to:tx.to,valueWei:BigInt(tx.value).toString(),input:tx.input,block:lo,status:receipt.status,feeWei:(BigInt(receipt.gasUsed)*BigInt(receipt.effectiveGasPrice)).toString(),logs:receipt.logs};
  rows.push(row);console.log(JSON.stringify({...row,logs:undefined}));
 }
 fs.mkdirSync('wallet-audit-output',{recursive:true});
 fs.writeFileSync('wallet-audit-output/report.json',JSON.stringify({address,count,pending,tip:tip.number,lastHash,rows},null,2));
 fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'只读核对：账本下一序号 275；链上 '+count+'；pending '+pending+'；额外交易 '+rows.length+' 笔。\n');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
