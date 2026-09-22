import {ACCOUNT,TOKEN,DISTRIBUTOR,AMOUNT,PLAN_SHA,word,addr,requireOK,validate,group,dataFor,verifyReceipt} from './core.mjs';
const $=id=>document.getElementById(id), key='butterfly-7031-20260922-v1';
let plan,provider,busy=false,done=0,ready=false,allowance=0n,remaining=0n,journal={receipts:{},pending:null};
try {journal=JSON.parse(localStorage.getItem(key))||journal;}catch{}
const save=()=>{localStorage.setItem(key,JSON.stringify(journal));renderHistory();};
const status=s=>{$('status').textContent=s;};
const rpc=(method,params=[])=>provider.request({method,params});
const call=(to,data,block='latest')=>rpc('eth_call',[{to,data},block]);
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
function renderHistory(){$('history').textContent=Object.entries(journal.receipts).map(([i,h])=>`第 ${Number(i)+1} 批：${h}`).join('\n')+(journal.pending?'\n待核对：'+JSON.stringify(journal.pending):'');}
function buttons(){for(const id of ['approve','send'])$(id).disabled=true;$('refresh').disabled=!provider||busy;$('restore').disabled=!provider||busy;$('connect').disabled=busy||!plan;if(!busy&&ready&&$('ack').checked){$('approve').disabled=allowance>=remaining;$('send').disabled=allowance<remaining;}}
async function identity(){requireOK(await rpc('eth_chainId')==='0x38','请在钱包切换到 BNB Smart Chain（56）后重新连接');const accounts=await rpc('eth_accounts');requireOK(accounts[0]?.toLowerCase()===ACCOUNT,'请切换到指定的 0x74a7…69aA 钱包');}
async function contractChecks(){
 const [code,expected,decimals,tokenCode]=await Promise.all([rpc('eth_getCode',[DISTRIBUTOR,'latest']),fetch('./runtime.txt').then(r=>{if(!r.ok)throw Error('合约基准文件读取失败');return r.text();}),call(TOKEN,'0x313ce567'),rpc('eth_getCode',[TOKEN,'latest'])]);
 requireOK(code.toLowerCase()===expected.trim().toLowerCase(),'链上分发合约代码与已固定版本不一致');requireOK(BigInt(decimals)===18n&&tokenCode!=='0x','代币合约或精度校验失败');
}
async function receipt(hash){const r=await rpc('eth_getTransactionReceipt',[hash]);requireOK(r,'交易尚未确认，请稍后刷新');return r;}
async function refresh(){
 ready=false;buttons();journal=JSON.parse(localStorage.getItem(key))||journal;await identity();
 const head=await rpc('eth_getBlockByNumber',['latest',false]);
 if(journal.pending){
  requireOK(journal.pending.hash,'上次钱包请求结果未知。请从钱包复制交易哈希到下方恢复栏，核对后再继续。');
  const r=await receipt(journal.pending.hash);
  requireOK(BigInt(head.number)-BigInt(r.blockNumber)>=2n,'等待当前交易至少3个区块确认');
  if(r.status==='0x1'&&Number.isInteger(journal.pending.batch)){
   const block=await rpc('eth_getBlockByNumber',[r.blockNumber,false]);
   verifyReceipt(plan,journal.pending.batch,r,head,block);journal.receipts[journal.pending.batch]=journal.pending.hash;
  }
  const failed=r.status!=='0x1';journal.pending=null;save();if(failed)throw Error('上一笔交易失败，未计入完成数量。请核对钱包错误，刷新后可重新检查。');
 }
 const complete=[];
 for(let start=0;start<36;start+=6){complete.push(...await Promise.all(plan.batchIds.slice(start,start+6).map(id=>call(DISTRIBUTOR,'0xfa1386ef'+addr(ACCOUNT)+id.slice(2),head.number).then(v=>BigInt(v)===1n))));}
 done=complete.indexOf(false);if(done<0)done=36;
 requireOK(!complete.slice(done).some(Boolean),'链上出现跳跃批次，请人工核对');
 $('progress').value=done;$('next').textContent=done===36?'全部 36 批已在链上完成':`下一批：第 ${done+1} / 36 批`;
 if(done===36){$('amount').textContent='7,031 个地址已完成。';status('全部完成，发送按钮已关闭。');return;}
 const count=group(plan,done).length;remaining=BigInt(7031-done*200)*AMOUNT;
 $('amount').textContent=`本批 ${count} 个地址，转出 ${(count*7777/10000).toFixed(4)} 枚。已完成 ${done} 批。`;
 if(done>0){
  const hash=journal.receipts[done-1];requireOK(hash,'已找到链上完成批次。请在下方粘贴上一批交易哈希，恢复60分钟计时。');
  const r=await receipt(hash),block=await rpc('eth_getBlockByNumber',[r.blockNumber,false]);
  const due=verifyReceipt(plan,done-1,r,head,block),seconds=due-Number(BigInt(head.timestamp));
  if(seconds>0){status(`已完成 ${done}/36 批。距离下一批至少 ${Math.ceil(seconds/60)} 分钟。到时需要你点击并确认钱包。`);return;}
 }
 const [pendingNonce,nonce,balance,authorized]=await Promise.all([rpc('eth_getTransactionCount',[ACCOUNT,'pending']),rpc('eth_getTransactionCount',[ACCOUNT,'latest']),call(TOKEN,'0x70a08231'+addr(ACCOUNT)),call(TOKEN,'0xdd62ed3e'+addr(ACCOUNT)+addr(DISTRIBUTOR))]);
 requireOK(pendingNonce===nonce,'钱包有待确认交易，请等待确认后继续');requireOK(BigInt(balance)>=remaining,'钱包代币余额不足以支付剩余全部批次');allowance=BigInt(authorized);ready=true;
 status(`已核对 BSC、指定钱包及链上批次。第 ${done+1} 批可以由你确认。${allowance<remaining?'请先授权剩余代币额度。':'授权额度充足。'}`);buttons();
}
async function guarded(fn){if(busy)return;busy=true;buttons();try{await fn();}catch(e){status(e?.message||'操作失败，请重试');}finally{busy=false;buttons();}}
async function send(kind){
 requireOK($('ack').checked,'请先勾选确认');await contractChecks();await refresh();requireOK(ready,'本批尚未到期或校验未通过');
 const batch=done;
 if(kind==='send')requireOK(allowance>=remaining,'请先完成代币授权');
 const reset=kind==='approve'&&allowance>0n;
 const data=kind==='send'?dataFor(plan,batch):'0x095ea7b3'+addr(DISTRIBUTOR)+word(reset?0n:remaining);
 const tx={from:ACCOUNT,to:kind==='send'?DISTRIBUTOR:TOKEN,value:'0x0',data};
 const estimate=BigInt(await rpc('eth_estimateGas',[tx]));
 tx.gas='0x'+((estimate*120n+99n)/100n).toString(16);
 await identity();requireOK(!journal.pending,'尚有交易待核对');
 journal.pending={kind:reset?'reset':kind,batch:kind==='send'?batch:null,hash:null};save();
 try{
  const hash=await rpc('eth_sendTransaction',[tx]);requireOK(/^0x[0-9a-fA-F]{64}$/.test(hash),'钱包返回的交易哈希异常');journal.pending.hash=hash;save();
  ready=false;$('ack').checked=false;status(`已提交到钱包并获得哈希：${hash}\n等待链上确认，请刷新进度。${reset?'旧额度归零后，需要再次点击授权。':''}`);
 }catch(e){if(e.code===4001){journal.pending=null;save();}throw e;}
}
$('connect').onclick=()=>guarded(async()=>{
 requireOK(window.ethereum,'请在安装 MetaMask 等钱包扩展的浏览器，或钱包内置浏览器打开本页');
 provider=window.ethereum;await rpc('eth_requestAccounts');await identity();await contractChecks();await refresh();
});
$('refresh').onclick=()=>guarded(refresh);
async function lockedSend(kind){requireOK(navigator.locks,'请使用支持安全锁的现代浏览器打开HTTPS页面');return navigator.locks.request(key,{ifAvailable:true},async lock=>{requireOK(lock,'另一个页面正在处理该钱包请求');await send(kind);});}
$('approve').onclick=()=>guarded(()=>lockedSend('approve'));
$('send').onclick=()=>guarded(()=>lockedSend('send'));
$('ack').onchange=buttons;
$('restore').onclick=()=>guarded(async()=>{
 await identity();const hash=$('hash').value.trim();requireOK(/^0x[0-9a-fA-F]{64}$/.test(hash),'交易哈希格式不正确');
 const tx=await rpc('eth_getTransactionByHash',[hash]);requireOK(tx&&tx.from.toLowerCase()===ACCOUNT,'交易不属于指定钱包');
 const i=plan.batchIds.findIndex((_,i)=>tx.to?.toLowerCase()===DISTRIBUTOR&&tx.input.toLowerCase()===dataFor(plan,i));
 if(i>=0){const r=await receipt(hash),head=await rpc('eth_getBlockByNumber',['latest',false]),block=await rpc('eth_getBlockByNumber',[r.blockNumber,false]);if(r.status==='0x1'){verifyReceipt(plan,i,r,head,block);journal.receipts[i]=hash;}else{requireOK(journal.pending?.batch===i,'这是一笔失败交易，不计入完成批次');}}
 else{
  requireOK(journal.pending&&journal.pending.kind!=='send'&&tx.to?.toLowerCase()===TOKEN&&tx.input.toLowerCase().startsWith('0x095ea7b3'+addr(DISTRIBUTOR)),'交易不是本任务的空投或待恢复授权');
  await receipt(hash);
 }
 if(journal.pending){requireOK((i>=0&&journal.pending.batch===i)||(i<0&&journal.pending.kind!=='send'),'交易与待确认记录不匹配');journal.pending.hash=hash;}
 save();await refresh();
});
$('export').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(journal,null,2)],{type:'application/json'}));a.download='butterfly-7031-receipts.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
if(window.ethereum?.on){for(const event of ['accountsChanged','chainChanged'])window.ethereum.on(event,()=>{ready=false;provider=null;buttons();status('钱包或网络已改变，请重新连接核对。');});}
setInterval(()=>{if(provider&&!busy)guarded(refresh);},60000);
try{const r=await fetch('./plan.json');requireOK(r.ok,'固定名单加载失败');const bytes=await r.arrayBuffer();requireOK(await sha(bytes)===PLAN_SHA,'固定名单文件校验失败');plan=validate(JSON.parse(new TextDecoder().decode(bytes)));status('7,031 个唯一地址与36个批次已校验。请连接指定钱包。');renderHistory();buttons();}catch(e){status(e.message);$('connect').disabled=true;}
