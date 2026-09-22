import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';import {build} from 'esbuild';
const root=fileURLToPath(new URL('../../',import.meta.url));
try{const m=JSON.parse(await fs.readFile(root+'nft/dual-release/assets/manifest.json'));if(m.collections.change.count!==7777||m.collections.rabbit.count!==7777)throw Error('incomplete');}catch{await import('./generate.mjs');}
const manifest=await fs.readFile(root+'nft/dual-release/assets/manifest.json');
const version=crypto.createHash('sha256').update(manifest).digest('hex').slice(0,20);
const prefix='/editions/'+version;
for(const key of ['change','rabbit']){
 const from=root+'nft/dual-release/assets/'+key,to=root+'dist'+prefix+'/'+key;
 await fs.mkdir(to,{recursive:true});await fs.cp(from+'/images',to+'/images',{recursive:true});
 await fs.mkdir(to+'/metadata',{recursive:true});
 for(let id=1;id<=7777;id++){
  const m=JSON.parse(await fs.readFile(from+`/metadata/${id}.json`));m.image=`https://zhongqiu.sh${prefix}/${key}/images/${id}.webp`;
  await fs.writeFile(to+`/metadata/${id}.json`,JSON.stringify(m));
 }
 await fs.copyFile(from+'/catalog.json',to+'/catalog.json');
}
await fs.writeFile(root+'dist/nft/edition-config.json',JSON.stringify({version,prefix,supply:7777,priceBNB:'0.001',manifestSha256:crypto.createHash('sha256').update(manifest).digest('hex')}));
await fs.writeFile(root+'dist'+prefix+'/manifest.json',manifest);
const deployment=JSON.parse(await fs.readFile(root+'dist/nft/deployment.json'));
const terms=JSON.parse(await fs.readFile(root+'dist/nft/terms.json'));terms.mintEnabled=deployment.status==='verified'&&deployment.websitePaused!==true;terms.tradingEnabled=terms.mintEnabled;
await fs.writeFile(root+'dist/nft/terms.json',JSON.stringify(terms,null,2));
await build({entryPoints:[root+'nft/dual-release/client.mjs'],bundle:true,minify:true,format:'esm',target:'es2022',outfile:root+'dist/nft/dual-client.js'});
console.log('Built both 7777 collections at',prefix);
