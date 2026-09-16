import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {makeNFT,SUPPLY} from './generate-butterfly-nfts.mjs';
const catalog=JSON.parse(readFileSync(new URL('../public/nft/catalog.json',import.meta.url),'utf8'));
assert.equal(catalog.length,SUPPLY);
assert.equal(readdirSync(new URL('../public/nft/art/',import.meta.url)).length,SUPPLY);
assert.equal(readdirSync(new URL('../public/nft/metadata/',import.meta.url)).length,SUPPLY);
const seen=new Set();
for(let index=0;index<SUPPLY;index++){
 const x=catalog[index];assert.equal(x.id,index+1);
 const art=readFileSync(new URL(`../public/nft/art/${x.id}.svg`,import.meta.url),'utf8');
 assert(!/<(?:text|script|foreignObject)\b/i.test(art),'Art must not depend on printed IDs or executable elements');
 const sha=createHash('sha256').update(art).digest('hex');assert.equal(sha,x.dna);assert(!seen.has(sha));seen.add(sha);
 const metadata=JSON.parse(readFileSync(new URL(`../public/nft/metadata/${x.id}.json`,import.meta.url),'utf8'));
 assert.equal(metadata.properties.edition,x.id);assert.equal(metadata.properties.artwork_sha256,sha);assert.equal(metadata.attributes.length,5);
}
assert.equal(makeNFT(7777).item.dna,catalog[7776].dna,'Generator is reproducible');
assert.throws(()=>makeNFT(0));assert.throws(()=>makeNFT(7778));
console.log(`PASS: ${SUPPLY} original artwork hashes, contiguous IDs, metadata pairs, deterministic generation; no numeric text in artwork.`);
