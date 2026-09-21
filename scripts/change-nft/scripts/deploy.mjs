import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {Wallet,JsonRpcProvider,ContractFactory,Contract,getCreateAddress,keccak256,parseEther,formatEther} from 'ethers';
import {compile,root} from './compile.mjs';
const EXPECTED='0x74a7D3198905C3b4BA53574C2DffEF3aa4e569aA';
const REVENUE='0x23898F0866E4D5fa5C9B97645239eD635EA93cDC';
const BASE='https://zhongqiu.sh/nft/metadata/';
const REPO='xuxi1234/flap-stock-meme';
const journalPath='scripts/change-nft/deployment.json';
const budget=parseEther('0.003');
const hash=b=>createHash('sha256').update(b).digest('hex');
async function github(method,body){const r=await fetch(`https://api.github.com/repos/${REPO}/contents/${journalPath}`,{method,headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json'},...(body?{body:JSON.stringify(body)}:{})});if(r.status===404&&method==='GET')return null;if(!r.ok)throw Error('Deployment checkpoint unavailable');return r.json();}
async function save(j,old){return github('PUT',{message:'Record Chang’e NFT deployment checkpoint',content:Buffer.from(JSON.stringify(j,null,2)).toString('base64'),branch:'main',...(old?{sha:old.sha}:{})});}
async function main(){
 const provider=new JsonRpcProvider(process.env.FLAP_BSC_RPC_URL||'https://bsc-dataseed.bnbchain.org');
 if((await provider.getNetwork()).chainId!==56n)throw Error('Wrong chain');
 const {artifact,input}=compile();
 const release=JSON.parse(fs.readFileSync(path.join(root,'collection-release.json')));
 const digest=release.manifestSha256;
 if(release.randomness!=='chainlink-vrf-v2.5-fifo')throw Error('Random release required');
 const vrf=new Contract(release.wrapper,['function link() view returns(address)','function estimateRequestPriceNative(uint32,uint32,uint256) view returns(uint256)'],provider);
 if((await vrf.link()).toLowerCase()!=='0x404460c6a5ede2d891e8297795264fde62adbb75')throw Error('VRF wrapper mismatch');
 const hosted=await fetch('https://zhongqiu.sh/nft/manifest.json');if(!hosted.ok)throw Error('Hosted manifest unavailable');
 const manifestBytes=Buffer.from(await hosted.arrayBuffer());if(hash(manifestBytes)!==digest)throw Error('Hosted collection does not match tested source');
 const manifest=JSON.parse(manifestBytes);if(manifest.count!==7777||manifest.entries.length!==7777||new Set(manifest.entries.map(x=>x.imageSha256)).size!==7777)throw Error('Incomplete or duplicate art');
 for(const token of [1,7777]){const m=await fetch(BASE+token+'.json');if(!m.ok||hash(Buffer.from(await m.arrayBuffer()))!==manifest.entries[token-1].metadataSha256)throw Error('Metadata unavailable');const img=await fetch(`https://zhongqiu.sh/nft/images/${token}.png`);if(!img.ok||hash(Buffer.from(await img.arrayBuffer()))!==manifest.entries[token-1].imageSha256)throw Error('Art unavailable');}
 const old=process.env.GITHUB_TOKEN?await github('GET'):null;
 if(old){const prior=JSON.parse(Buffer.from(old.content,'base64').toString());const receipt=await provider.getTransactionReceipt(prior.transactionHash);if(receipt?.status===1){
 if(prior.project!=='zhongqiu.sh/change-7777'||receipt.contractAddress?.toLowerCase()!==prior.address.toLowerCase()||receipt.from.toLowerCase()!==EXPECTED.toLowerCase()||prior.manifestHash!=='0x'+digest||keccak256(await provider.getCode(prior.address))!==release.runtimeHash)throw Error('Existing deployment does not match this release');
 if(prior.status!=='mined'&&process.env.NFT_OPERATION==='deploy')await save({...prior,status:'mined',blockNumber:receipt.blockNumber},old);
 console.log('Already deployed:',prior.address);return;
}throw Error('An earlier deployment checkpoint exists; inspect its transaction before another attempt.');}
 const pending=await provider.getTransactionCount(EXPECTED,'pending');if(pending!==await provider.getTransactionCount(EXPECTED,'latest'))throw Error('Wallet has pending transactions');
 const factory=new ContractFactory(artifact.abi,artifact.evm.bytecode.object);
 const tx=await factory.getDeployTransaction(BASE,'0x'+digest);
 const estimate=await provider.estimateGas({...tx,from:EXPECTED});
 const gasLimit=estimate*120n/100n;
 const fee=await provider.getFeeData();const gasPrice=fee.gasPrice;if(!gasPrice)throw Error('Gas price unavailable');
 const maximum=gasLimit*gasPrice;if(maximum>budget)throw Error('Deployment exceeds 0.003 BNB gas cap');
 const balance=await provider.getBalance(EXPECTED);if(balance<maximum)throw Error('Insufficient BNB for deployment');
 const vrfQuote=await vrf.estimateRequestPriceNative(100000,1,gasPrice);
 console.log(JSON.stringify({randomness:release.randomness,randomnessRequestBNB:formatEther(vrfQuote),reserveFunding:'Separate sponsor reserve required before sales; this workflow does not fund it',mode:process.env.NFT_OPERATION||'check',chainId:56,deployer:EXPECTED,revenue:REVENUE,supply:7777,priceBNB:'0.001',nonce:pending,estimatedGas:estimate.toString(),maxGasBNB:formatEther(maximum),hardBudgetBNB:'0.003',manifestHash:'0x'+digest},null,2));
 if(process.env.NFT_OPERATION!=='deploy')return;
 if(process.env.GITHUB_EVENT_NAME!=='workflow_dispatch'||process.env.GITHUB_REF!=='refs/heads/main'||process.env.GITHUB_REPOSITORY!==REPO||process.env.NFT_CONFIRM!=='7777:0.001:random-vrf:revenue23898:gas0.003')throw Error('Manual main-branch confirmation required');
 // Do not displace another queued workflow; GitHub concurrency groups can evict pending runs.
 const runResponse=await fetch(`https://api.github.com/repos/${REPO}/actions/runs?per_page=100`,{headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json'}});
 if(!runResponse.ok)throw Error('Cannot check other wallet workflows');
 const active=(await runResponse.json()).workflow_runs.filter(r=>String(r.id)!==process.env.GITHUB_RUN_ID&&/airdrop|mint/i.test(r.path||'')&&['queued','in_progress','waiting','pending','requested'].includes(r.status));
 if(active.length)throw Error('Another airdrop or mint workflow is active or queued; let it finish first');
 if(await provider.getTransactionCount(EXPECTED,'pending')!==pending)throw Error('Wallet nonce changed during checks');
 const wallet=new Wallet(process.env.FLAP_MINT_PRIVATE_KEY||'',provider);if(wallet.address.toLowerCase()!==EXPECTED.toLowerCase())throw Error('Configured signer is not the authorized wallet');
 const unsigned={...tx,chainId:56,nonce:pending,gasLimit,gasPrice,type:0,value:0};
 const signed=await wallet.signTransaction(unsigned);
 const journal={project:'zhongqiu.sh/change-7777',address:getCreateAddress({from:wallet.address,nonce:pending}),transactionHash:keccak256(signed),manifestHash:'0x'+digest,nonce:pending,maxGasBNB:formatEther(maximum),status:'prepared'};
 await save(journal,null); // Persist identity BEFORE broadcast; reruns cannot create another collection.
 const sent=await provider.broadcastTransaction(signed);const receipt=await sent.wait(3,180000);if(receipt.status!==1)throw Error('Deployment failed; checkpoint retained');
 const deployed=new Contract(journal.address,artifact.abi,provider);
 if(keccak256(await provider.getCode(journal.address))!==release.runtimeHash)throw Error('Post-deployment bytecode mismatch');
 if(await deployed.MINT_PRICE()!==parseEther('0.001')||await deployed.MAX_SUPPLY()!==7777n||await deployed.REVENUE()!==REVENUE||await deployed.manifestHash()!=='0x'+digest)throw Error('Post-deployment verification failed');
 const live=await github('GET');await save({...journal,status:'mined',blockNumber:receipt.blockNumber},live);
 fs.mkdirSync(path.join(root,'build'),{recursive:true});fs.writeFileSync(path.join(root,'build/deployment.json'),JSON.stringify({...journal,status:'mined'},null,2));fs.writeFileSync(path.join(root,'build/compiler-input.json'),JSON.stringify(input));
 fs.writeFileSync(path.join(root,'build/tp-info.json'),JSON.stringify({name:"Chang'e Fairies",website:'https://zhongqiu.sh/nft/',description:'7777 original generative Chang’e fairy portraits by Butterfly Mid-Autumn.',explorer:'https://bscscan.com/token/'+journal.address,type:'ERC721',symbol:'CHANGE',decimals:0,status:'active',id:journal.address},null,2));
 console.log('DEPLOYED',journal.address,'TX',sent.hash);
 // Best-effort independent source verification; failure never redeploys or spends more gas.
 try{const files={'metadata.json':artifact.metadata,...Object.fromEntries(Object.entries(input.sources).map(([name,v])=>[name,v.content]))};const v=await fetch('https://sourcify.dev/server/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({address:journal.address,chain:'56',files})});console.log('Source verification HTTP',v.status);}catch{console.log('Source verification pending; use saved compiler input.');}
}
main().catch(e=>{const message=String(e?.message||'');if(/^(Another airdrop|Wallet nonce|Wallet has pending|Insufficient BNB|Deployment exceeds|An earlier deployment|Hosted|Incomplete|Wrong chain|Configured signer|Manual main-branch)/.test(message))console.error(message);else console.error('Deployment check stopped. Check chain, signer, hosted assets and checkpoint. No secrets are printed.');process.exitCode=1;});
