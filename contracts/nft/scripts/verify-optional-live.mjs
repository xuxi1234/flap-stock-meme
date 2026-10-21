// Independent, read-only acceptance of the preserved launch journal.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import solc from 'solc';
import {Contract,keccak256,parseEther} from 'ethers';import {BscProvider} from './bsc-provider.mjs';
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'));
const j=JSON.parse(fs.readFileSync(process.argv[2]));const assert=(ok,m)=>{if(!ok)throw Error(m)};
assert(j.completed&&j.payer==='0x74a7D3198905C3b4BA53574C2DffEF3aa4e569aA','Incomplete or wrong payer');
const sources={};for(const dir of ['src','test'])for(const f of fs.readdirSync(dir))if(f.endsWith('.sol'))sources[`${dir}/${f}`]={content:fs.readFileSync(`${dir}/${f}`,'utf8')};
const output=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources,settings:{optimizer:{enabled:true,runs:200},evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.deployedBytecode']}}}}),{import:p=>({contents:fs.readFileSync('node_modules/'+p,'utf8')})}));
assert(!(output.errors||[]).some(x=>x.severity==='error'),'Compile error');
const p=new BscProvider(process.env.NFT_RPC_URL||'https://bsc-dataseed.binance.org');
try{
 assert((await p.getNetwork()).chainId===56n,'Wrong chain');
 const addresses={ButterflyDirectVRF:j.adapter,ButterflyNFT:j.collection,ButterflyMarket:j.market},result={};
 for(const [name,address] of Object.entries(addresses)){
  const art=output.contracts[`src/${name}.sol`][name],code=await p.getCode(address);let actual=code.slice(2),expected=art.evm.deployedBytecode.object;
  for(const refs of Object.values(art.evm.deployedBytecode.immutableReferences))for(const {start,length}of refs){actual=actual.slice(0,start*2)+'0'.repeat(length*2)+actual.slice((start+length)*2);expected=expected.slice(0,start*2)+'0'.repeat(length*2)+expected.slice((start+length)*2)}
  assert(actual===expected,name+' runtime mismatch');result[name]={address,codeHash:keccak256(code)};
 }
 let spent=BigInt(j.priorWei);const head=await p.getBlockNumber();
 for(const [name,step]of Object.entries(j.steps)){const r=await p.getTransactionReceipt(step.hash),tx=await p.getTransaction(step.hash);assert(r?.status===1&&r.blockHash===step.receipt.blockHash&&head-r.blockNumber>=2,'Receipt '+name);assert(tx.from===j.payer&&tx.value===BigInt(step.intent.value)&&keccak256(tx.data)===step.intent.dataHash,'Transaction '+name);spent+=tx.value+r.gasUsed*r.gasPrice;}
 assert(spent===BigInt(j.spentWei)&&spent<=parseEther('0.045'),'Budget mismatch');
 const n=new Contract(j.collection,output.contracts['src/ButterflyNFT.sol'].ButterflyNFT.abi,p),a=new Contract(j.adapter,output.contracts['src/ButterflyDirectVRF.sol'].ButterflyDirectVRF.abi,p),m=new Contract(j.market,output.contracts['src/ButterflyMarket.sol'].ButterflyMarket.abi,p);
 assert(await n.OPTIONAL_REFERRER()&&await n.MINT_PRICE()===parseEther('0.01')&&await n.REFERRAL_BPS()===2000n&&await n.MAX_BATCH()===20n&&await n.MAX_SUPPLY()===7777n,'Economics mismatch');
 assert(await n.TREASURY()==='0x764dBCD80ca3E5d50CBAe986e2b6F507Dc47CfcF'&&await n.randomness()===j.adapter&&await a.collection()===j.collection&&await m.collection()===j.collection&&await m.FEE_BPS()===0n,'Binding mismatch');
 assert(await a.wrapper()==='0x471506e6ADED0b9811D05B8cAc8Db25eE839Ac94'&&await a.CALLBACK_GAS_LIMIT()===100000n&&await a.CONFIRMATIONS()===10n&&await a.MAX_ORACLE_FEE()===parseEther('0.0001'),'Oracle mismatch');
 const req=await n.requests(j.requestId),zero='0x0000000000000000000000000000000000000000';assert(req.claimed&&req.referrer===zero&&await n.ownerOf(j.tokenId)===j.payer&&await n.referralRewards(zero)===0n,'Mint acceptance mismatch');
 const old=new Contract('0xAdB01BC76a6d9eF707297744777E77528B6013BA',['function ownerOf(uint256) view returns(address)'],p);result.legacyOwner=await old.ownerOf(2032);assert(result.legacyOwner===j.payer,'Original NFT ownership changed');
 result.totalWei=spent.toString();result.tokenId=j.tokenId;result.tokenURI=await n.tokenURI(j.tokenId);result.optionalReferrer=true;console.log(JSON.stringify(result,null,2));
}finally{await p.destroy()}
