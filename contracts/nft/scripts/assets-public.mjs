import fs from 'node:fs';
import {HOSTING_PROPOSAL,verifyPublicAssets} from './launch.mjs';

// Read-only publication verification. Never imports a signer or sends a transaction.
const attempts=Number(process.env.NFT_ASSET_CHECK_ATTEMPTS||'1');
if(!Number.isInteger(attempts)||attempts<1||attempts>30)throw Error('Invalid attempt bound');
for(let attempt=1;attempt<=attempts;attempt++){
 try{
  const result=await verifyPublicAssets({base:HOSTING_PROPOSAL.metadataBase,assetBase:HOSTING_PROPOSAL.assetBase});
  const report={checkedAt:new Date().toISOString(),authenticated:false,signerLoaded:false,transactionsSent:0,...result};
  fs.writeFileSync(new URL('../assets-public.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  break;
 }catch(error){
  console.log(`Public asset check ${attempt}/${attempts}: ${error.message}`);
  if(attempt===attempts)throw error;
  await new Promise(resolve=>setTimeout(resolve,30000));
 }
}
