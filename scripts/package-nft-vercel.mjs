import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
function sources(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?sources(`${dir}/${entry.name}`):!entry.name.includes('.test.')&&/\.(tsx?|css|json)$/.test(entry.name)?[`${dir}/${entry.name}`]:[])}
const files=['package.json','package-lock.json','tsconfig.json','vite.nft.config.ts','nft.html','src/vite-env.d.ts','api/swap-rpc.ts','scripts/generate-butterfly-nfts.mjs','scripts/nft-company-themes.mjs','data/nft-companies.json','scripts/verify-butterfly-nfts.mjs','scripts/nft-art/package.json','scripts/nft-art/package-lock.json','scripts/nft-art/raster-worker.mjs','public/nft-layout-check.html',...sources('src/nft')].map(file=>({file,data:readFileSync(file,'utf8')}));
files.push({file:'vercel.json',data:JSON.stringify({buildCommand:'NFT_ASSET_BASE_URL=https://flap-stock-butterfly-7777.vercel.app/nft npm run build:nft',outputDirectory:'dist',headers:[{source:'/nft/(.*)',headers:[{key:'Access-Control-Allow-Origin',value:'*'},{key:'Cache-Control',value:'public, max-age=0, must-revalidate'}]}]})});
mkdirSync('.superpowers/sdd/2026-09-18-nft-referral-batch',{recursive:true});writeFileSync('.superpowers/sdd/2026-09-18-nft-referral-batch/standalone-files.json',JSON.stringify(files));
console.log(`Packaged ${files.length} source files; generated art is rebuilt and verified.`);

