import {JsonRpcProvider} from 'ethers';
// Some BSC RPCs encode contract creation as an empty destination instead of null.
export function normalizeCreation(method,result){
 if(result && ['eth_getTransactionByHash','eth_getTransactionReceipt'].includes(method) && result.to==='')return {...result,to:null};
 return result;
}
export class BscProvider extends JsonRpcProvider{
 async send(method,params){return normalizeCreation(method,await super.send(method,params));}
}
