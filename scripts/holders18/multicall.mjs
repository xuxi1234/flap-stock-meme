import {createRequire} from 'node:module';
const require=createRequire(new URL('../mint-acceptance/package.json',import.meta.url));
const {encodeFunctionData,decodeFunctionResult,multicall3Abi,keccak256}=require('viem');
export const MULTICALL='0xca11bde05977b3631167028862be2a173976ca11';
// Runtime extracted from the canonical Multicall3 repository's public deployment
// initcode (CODECOPY offset 0x20, length 0xee0). No deployment is performed.
// https://github.com/mds1/multicall3#deployments-and-abi
const RUNTIME_HASH='0xd5c15df687b16f2ff992fc8d767b4216323184a2bbc6ee2f9c398c318e770891';
export async function verifyMulticall(rpc,tag){
 const code=await rpc('eth_getCode',[MULTICALL,tag]);if(keccak256(code)!==RUNTIME_HASH)throw new Error('Multicall3 runtime does not match canonical deployment');
}
export async function readBalances(addresses,rpc,token,tag){
 if(addresses.length<1||addresses.length>100)throw new Error('Invalid balance batch size');
 const data=encodeFunctionData({abi:multicall3Abi,functionName:'aggregate3',args:[addresses.map(a=>({target:token,allowFailure:false,callData:'0x70a08231'+a.slice(2).padStart(64,'0')}))]});
 const raw=await rpc('eth_call',[{to:MULTICALL,data,gas:'0x1c9c380'},tag]);
 const rows=decodeFunctionResult({abi:multicall3Abi,functionName:'aggregate3',data:raw});
 if(rows.length!==addresses.length||rows.some(r=>!r.success||!/^0x[0-9a-fA-F]{64}$/.test(r.returnData)))throw new Error('Incomplete balance batch');
 return rows.map(r=>BigInt(r.returnData).toString());
}
