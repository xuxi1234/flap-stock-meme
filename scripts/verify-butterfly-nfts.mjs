import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {makeNFT,SUPPLY} from './generate-butterfly-nfts.mjs';
const catalog=JSON.parse(readFileSync(new URL('../public/nft/catalog.json',import.meta.url)));
assert.equal(catalog.length,SUPPLY);assert.equal(readdirSync(new URL('../public/nft/art/',import.meta.url)).length,SUPPLY);
assert.equal(readdirSync(new URL('../public/nft/metadata/',import.meta.url)).length,SUPPLY+1);
const artHashes=new Set(),imageHashes=new Set();
for(let index=0;index<SUPPLY;index++){
 const x=catalog[index];assert.equal(x.id,index+1);const generated=makeNFT(x.id);
 assert(!/<(?:text|script|foreignObject)\b/i.test(generated.art));assert.equal(generated.item.dna,x.dna);assert(!artHashes.has(x.dna));artHashes.add(x.dna);
 const file=readFileSync(new URL(`../public${x.image}`,import.meta.url));assert.equal(file[0],0xff);assert.equal(file[1],0xd8);
 const imageHash=createHash('sha256').update(file).digest('hex');assert.equal(imageHash,x.imageHash);assert(!imageHashes.has(imageHash));imageHashes.add(imageHash);
 const metadata=JSON.parse(readFileSync(new URL(`../public/nft/metadata/${x.id}.json`,import.meta.url)));
 assert.equal(metadata.properties.edition,x.id);assert.equal(metadata.properties.artwork_sha256,x.dna);assert.equal(metadata.properties.image_sha256,imageHash);assert(/^https?:\/\//.test(metadata.image));assert(metadata.image.endsWith(`/art/${x.id}.jpg`));assert.equal(metadata.attributes.length,11);assert.equal(metadata.attributes.find(a=>a.trait_type==='Reference Symbol').value,x.theme.ticker);assert(metadata.name.includes(x.theme.name));
}
const counts=new Map();for(const x of catalog){const key=x.theme.ticker;counts.set(key,(counts.get(key)||0)+1)}assert.equal(counts.size,501);assert.equal(counts.get('FLAP STOCK'),277);for(const [key,count]of counts)if(key!=='FLAP STOCK')assert.equal(count,15);
assert.throws(()=>makeNFT(0));assert.throws(()=>makeNFT(7778));
console.log(`PASS: ${SUPPLY} unique artwork and JPEG hashes, IDs, metadata, deterministic generator.`);

