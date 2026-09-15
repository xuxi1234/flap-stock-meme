import fs from 'node:fs';
import {rpc,publish,safe} from './io.mjs';
const token='0xa1ed61902f13e162305f59e1b2475e269e647777',tag='0x'+(122011886).toString(16);
const decode=v=>{const b=Buffer.from(v.slice(2),'hex');return b.length===32?b.toString('utf8').replace(/\0/g,''):b.subarray(64,64+Number(BigInt('0x'+b.subarray(32,64).toString('hex')))).toString('utf8');};
async function main(){
 const code=await rpc('eth_getCode',[token,tag]);
 const result={token,snapshotBlock:122011886,code,name:decode(await rpc('eth_call',[{to:token,data:'0x06fdde03'},tag])),symbol:decode(await rpc('eth_call',[{to:token,data:'0x95d89b41'},tag])),totalSupply:BigInt(await rpc('eth_call',[{to:token,data:'0x18160ddd'},tag])).toString(),decimals:Number(BigInt(await rpc('eth_call',[{to:token,data:'0x313ce567'},tag])))};
 const match=code.match(/^0x363d3d373d3d3d363d73([0-9a-fA-F]{40})5af43d82803e903d91602b57fd5bf3$/);
 if(match){result.implementation='0x'+match[1];result.implementationCode=await rpc('eth_getCode',[result.implementation,tag]);}
 const content=JSON.stringify(result,null,2)+'\n';fs.mkdirSync('holders18-inspect-output',{recursive:true});fs.writeFileSync('holders18-inspect-output/special-token.json',content);await publish({'special-token.json':content});
 console.log(JSON.stringify({token,name:result.name,symbol:result.symbol,codeBytes:(code.length-2)/2,implementation:result.implementation||null,totalSupply:result.totalSupply}));
}
main().catch(e=>{console.error(safe(e));process.exitCode=1;});
