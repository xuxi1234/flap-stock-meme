import assert from 'node:assert/strict';
import {companyTheme,snapshot,specialIds,requestedSpecialIds} from './nft-company-themes.mjs';
import {makeNFT} from './generate-butterfly-nfts.mjs';
assert.equal(snapshot.companies.length,500);
assert.equal(new Set(snapshot.companies.map(c=>c.name)).size,500);
assert.equal(specialIds.length,277);assert.equal(new Set(specialIds).size,277);for(const id of requestedSpecialIds)assert(specialIds.includes(id));
const counts=new Map();
for(let id=1;id<=7777;id++){
 const t=companyTheme(id);counts.set(t.ticker,(counts.get(t.ticker)||0)+1);
 assert(t.edition>=1&&t.edition<=t.total);
}
assert.equal(counts.size,501);assert.equal(counts.get('FLAP STOCK'),277);
for(const [key,value]of counts)if(key!=='FLAP STOCK')assert.equal(value,15);
for(const id of [1,500,501,7500,7501,7777]){
 const {item,metadata}=makeNFT(id);const t=companyTheme(id);
 assert.equal(item.theme.ticker,t.ticker);assert.equal(metadata.attributes.length,11);
 assert(metadata.name.includes(t.name));assert(metadata.description.includes('no affiliation'));
}
assert.throws(()=>companyTheme(0));assert.throws(()=>companyTheme(7778));
console.log('PASS: 500 companies × 15 editions + 277 originals; boundaries, names and metadata.');
