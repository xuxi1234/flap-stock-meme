import {workerData,parentPort} from 'node:worker_threads';
import {writeFileSync,readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Resvg} from '@resvg/resvg-js';
import sharp from 'sharp';
import {makeNFT,SUPPLY} from '../generate-butterfly-nfts.mjs';
sharp.concurrency(1);
const renderer='resvg-2.6.2/sharp-0.34.5/640/jpeg91/444';
const hash=b=>createHash('sha256').update(b).digest('hex');
for(let id=workerData.index+1;id<=SUPPLY;id+=workerData.count){
 const file=`${workerData.output}/art/${id}.jpg`,proof=`${workerData.output}/integrity/${id}.json`;
 const {art,item}=makeNFT(id);
 let valid=false;
 if(existsSync(file)&&existsSync(proof))try{const p=JSON.parse(readFileSync(proof));valid=p.renderer===renderer&&p.artwork_sha256===item.dna&&p.image_sha256===hash(readFileSync(file));}catch{/* regenerate corrupt cache */}
 if(!valid){
  const png=new Resvg(art,{fitTo:{mode:'width',value:640}}).render().asPng();
  const jpg=await sharp(png).jpeg({quality:91,chromaSubsampling:'4:4:4'}).toBuffer();
  writeFileSync(file,jpg);writeFileSync(proof,JSON.stringify({renderer,artwork_sha256:item.dna,image_sha256:hash(jpg)}));
 }
}
parentPort.postMessage('done');
