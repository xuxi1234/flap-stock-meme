import { Stop } from './core.mjs';
const transient=new Set(['HttpRequestError','TimeoutError','RpcRequestError','InternalRpcError','LimitExceededRpcError','ResourceUnavailableRpcError','TransactionNotFoundError','BlockNotFoundError','SocketClosedError']);
function isTransient(error){
 for(let e=error,i=0;e&&i<10;e=e.cause,i++)if(transient.has(e.name))return true;
 return false;
}
export async function readWithRetry(read,stage,{wait=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 for(let attempt=1;attempt<=3;attempt++){
  try{return await read();}catch(e){
   if(!isTransient(e))throw e;
   if(attempt===3)throw new Stop(`${stage}：节点读取重试3次仍未完成，已停止；保留原交易哈希，不重复发送。`);
   await wait(attempt*1000);
  }
 }
}
