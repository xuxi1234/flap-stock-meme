import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {Worker} from 'node:worker_threads';
import {companyTheme,themeAttributes,snapshot,specialIds,mappingVersion} from './nft-company-themes.mjs';
export const SUPPLY=7777;
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const VERSION='butterfly-nature-v3';
// Original stylized interpretations, not scientific specimen photographs.
const FAMILIES=[
 ['蓝闪蝶','Morpho-inspired','#178bff','#86f4ff','#edf7fc','round','veins'],
 ['帝王蝶','Monarch-inspired','#f97918','#ffd163','#fff2dc','round','cells'],
 ['碧凤蝶','Emerald swallowtail-inspired','#04a470','#96ff8a','#e9f7ed','tail','ribbon'],
 ['孔雀蛱蝶','Peacock-inspired','#bc241e','#fe9d48','#f8e4e5','scallop','eyes'],
 ['虎纹凤蝶','Tiger swallowtail-inspired','#f9d14d','#fff4a3','#fbf4d8','tail','tiger'],
 ['透翅蝶','Glasswing-inspired','#b37842','#ffffff','#edeafa','long','glass'],
 ['红带蛱蝶','Red admiral-inspired','#ed4432','#ffc587','#f5e9df','scallop','ribbon'],
 ['玫瑰凤蝶','Common rose-inspired','#ed3374','#ffa7bb','#fae6ef','tail','rose'],
 ['金鸟翼蝶','Golden birdwing-inspired','#ebb928','#ffed77','#f8f1d7','long','bird'],
 ['斑马蝶','Zebra longwing-inspired','#e4eacd','#ffffff','#ebf2e7','long','zebra'],
 ['紫斑蝶','Purple crow-inspired','#7855d9','#d7c0ff','#f0eafb','round','spots'],
 ['柑橘凤蝶','Citrus swallowtail-inspired','#eadb8c','#fff9d3','#f4f1df','scallop','mosaic'],
];
const hash=x=>createHash('sha256').update(x).digest('hex');
const n=x=>Number(x.toFixed(2));
function rng(seed){let s=seed>>>0;return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function makeNFT(id){
 if(!Number.isInteger(id)||id<1||id>SUPPLY)throw Error('Invalid edition');
 const r=rng(parseInt(hash(`${VERSION}:${id}`).slice(0,8),16));
 const familyIndex=Math.floor(r()*FAMILIES.length);
 const [family,palette,color,light,bg,shape,pattern]=FAMILIES[familyIndex];
 const width=n(194+r()*26),top=n(-194-r()*22),tip=n(148+r()*26),bottom=n(130+r()*28),tail=n(196+r()*20);
 const upper=`M 9 -8 C 42 -80 102 ${top-24} ${width} ${top} Q ${width+24} ${top+16} ${width+13} ${top+63} C ${width+16} -62 ${width-5} -28 ${tip} -9 Q 68 18 10 13 Z`;
 const lower=shape==='tail'?`M 10 12 Q 146 -22 192 42 Q 199 77 162 107 L 140 ${tail} Q 127 ${tail+26} 126 ${tail-8} L 128 128 Q 89 165 65 135 Q 27 111 10 12 Z`:shape==='long'?`M 10 12 Q 109 -1 150 27 Q 181 51 160 102 Q 138 ${bottom+22} 101 ${bottom} Q 40 132 10 12 Z`:shape==='scallop'?`M 10 12 Q 148 -18 181 28 Q 201 55 178 74 Q 193 93 164 105 Q 171 123 142 125 Q 133 150 112 143 Q 91 165  seventy 132 Q 30 119 10 12 Z`.replace('seventy','70'):`M 10 12 Q 146 -19 182 28 Q 203 58 174 100 Q 148 ${bottom+10} 111 ${bottom} Q 36 143 10 12 Z`;
 let cells='',veins='',speckles='',margins='';
 // Vary actual vein geometry and edge ornament for every edition; mirrored natural symmetry.
 for(let i=0;i<9;i++){
  const x=n(58+i*17+r()*9),y=n(top+32+i*15+r()*8);
  veins+=`<path d="M 10 4 Q ${n(x*.42)} ${n(y*.55)} ${x} ${y}"/>`;
  if(pattern==='cells'||pattern==='mosaic')cells+=`<path d="M ${n(25+i*2)} ${n(-10-i*3)} Q ${n(x*.67)} ${n(y*.85)} ${x-8} ${y+12} Q ${x+10} ${y+20} ${x+8} ${y+31} Q ${n(x*.55)} ${n(y*.3)} 20 4" fill="${i%3?color:light}" stroke="#252526" stroke-width="3.5"/>`;
 }
 for(let i=0;i<7;i++){const x=n(54+i*17+r()*7),y=n(47+i*11+r()*7);veins+=`<path d="M 12 13 Q ${n(x*.76)} ${n(y*.27)} ${x} ${y}"/>`;}
 for(let i=0;i<19;i++){const t=i/18,x=n(width+5-Math.sin(t*Math.PI)*9-t*t*38),y=n(top+20+t*190);margins+=`<ellipse cx="${x}" cy="${y}" rx="${n(2.2+r()*1.6)}" ry="${n(3.6+r()*1.4)}" fill="${pattern==='rose'?'#fd698d':'#fff5d6'}"/>`;}
 for(let i=0;i<11;i++){const a=.05+i*.16;const x=n(105+Math.cos(a)*68),y=n(60+Math.sin(a)*72);margins+=`<circle cx="${x}" cy="${y}" r="${n(2+r()*2)}" fill="${pattern==='rose'?'#ff567e':light}"/>`;}
 if(pattern==='ribbon'||pattern==='rose')cells+=`<path d="M 45 -58 Q 125 -50 226 -150 L 236 -100 Q 136 -19 70 -22 Z" fill="${color}"/><path d="M 42 34 Q 118 98 160 60 L 180 92 Q 90 137 42 34" fill="${color}"/>`;
 if(pattern==='tiger'||pattern==='zebra')for(let i=0;i<6;i++)cells+=`<path d="M ${50+i*29} ${top-5+i*3} Q ${55+i*21} ${-85+i*13} ${26+i*11} ${-20+i*5} Q ${101+i*14} ${-87+i*10} ${78+i*29} ${top+4+i*4} Z" fill="#202626"/>`;
 if(pattern==='bird')cells+=`<path d="M 13 12 Q 128 -20 186 45 Q 163 140 98 135 Q 46 110 13 12" fill="${color}"/><path d="M 40 -37 Q 100 -143 172 -177 L 179 -140 Q 98 -50 40 -37" fill="${color}"/>`;
 if(pattern==='glass')cells+=`<path d="${upper}" fill="#fbfdff" fill-opacity=".82" stroke="#905227" stroke-width="14"/><path d="${lower}" fill="#fbfdff" fill-opacity=".75" stroke="#905227" stroke-width="12"/><path d="M 90 -84 L 192 -142 L 188 -114 L 98 -65 Z" fill="white" opacity=".8"/>`;
 if(pattern==='eyes')for(const [x,y,size]of[[158,-120,30],[124,80,28]])cells+=`<ellipse cx="${x}" cy="${y}" rx="${size*1.2}" ry="${size}" fill="#e8c078" stroke="#493737" stroke-width="5"/><ellipse cx="${x}" cy="${y}" rx="${size*.86}" ry="${size*.79}" fill="#182335"/><ellipse cx="${x+2}" cy="${y+5}" rx="${size*.57}" ry="${size*.49}" fill="#669fff"/><ellipse cx="${x}" cy="${y-2}" rx="${size*.47}" ry="${size*.48}" fill="#102130"/><path d="M ${x-10} ${y+8} Q ${x} ${y+20} ${x+12} ${y+8}" fill="none" stroke="#a9ffff" stroke-width="3"/>`;
 if(pattern==='spots'||pattern==='mosaic'||pattern==='rose')for(let i=0;i<29;i++){const x=n(45+r()*141),y=n(-155+r()*260);cells+=`<ellipse cx="${x}" cy="${y}" rx="${n(3+r()*5)}" ry="${n(4+r()*8)}" fill="${pattern==='rose'?color:light}" opacity=".86" transform="rotate(-25 ${x} ${y})"/>`;}
 // Fine scale texture; deterministic per-image randomness, visibly distinct geometry.
 for(let i=0;i<110;i++){const x=n(16+r()*210),y=n(-211+r()*360);speckles+=`<path d="M${x} ${y}l${n(1+r()*3)} ${n(-1-r()*2)}" stroke="${i%3?light:'#1c2930'}" stroke-width=".7" opacity="${n(.12+r()*.22)}"/>`;}
 const fill=['ribbon','rose','bird'].includes(pattern)?'#1b2526':'url(#wing)';
 const rotation=n(-4+r()*8),scale=n(.99+r()*.065);
 const art=`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640"><defs><radialGradient id="bg"><stop stop-color="#ffffff"/><stop offset="1" stop-color="${bg}"/></radialGradient><linearGradient id="wing" x1="0" y1="0" x2="1" y2=".7"><stop stop-color="${light}"/><stop offset=".5" stop-color="${color}"/><stop offset="1" stop-color="${color}"/></linearGradient><linearGradient id="body"><stop stop-color="#172527"/><stop offset=".45" stop-color="#786e52"/><stop offset="1" stop-color="#172527"/></linearGradient><clipPath id="clip"><path d="${upper}"/><path d="${lower}"/></clipPath><filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="12" stdDeviation="10" flood-color="#25424d" flood-opacity=".2"/></filter></defs><rect width="640" height="640" fill="url(#bg)"/><circle cx="320" cy="305" r="265" fill="none" stroke="${color}" stroke-width=".7" opacity=".13"/><g transform="translate(320 326) rotate(${rotation}) scale(${scale})" filter="url(#shadow)"><g id="half"><path d="${upper}" fill="${fill}" stroke="#242729" stroke-width="11" stroke-linejoin="round"/><path d="${lower}" fill="${fill}" stroke="#242729" stroke-width="10" stroke-linejoin="round"/><g clip-path="url(#clip)">${cells}<g fill="none" stroke="${pattern==='veins'?'#194061':'#302f29'}" stroke-width="${pattern==='cells'?1.6:1.15}" opacity=".68">${veins}</g>${speckles}${margins}</g></g><use href="#half" transform="scale(-1 1)"/><ellipse cy="36" rx="7" ry="66" fill="url(#body)"/><ellipse cy="-12" rx="12" ry="29" fill="url(#body)"/><circle cy="-39" r="9" fill="#233033"/><path d="M -5 -45 Q -17 -88 -33 -105 M 5 -45 Q 17 -88 33 -105" fill="none" stroke="#253033" stroke-width="1.8"/><ellipse cx="-33" cy="-105" rx="2.2" ry="4" fill="#253033"/><ellipse cx="33" cy="-105" rx="2.2" ry="4" fill="#253033"/></g></svg>`;
 const dna=hash(art),rarity=['典藏','稀有','史诗','传说'][r()<.025?3:r()<.12?2:r()<.32?1:0];
 const item={id,name:`${family} #${String(id).padStart(4,'0')}`,family,palette,color,rarity,wing:shape,pattern,halo:'自然光',dna,image:`/nft/art/${id}.jpg`};
 const base=process.env.NFT_ASSET_BASE_URL?.replace(/\/$/,'')|| (process.env.VERCEL_URL?`https://${process.env.VERCEL_URL}/nft`:'http://localhost:5173/nft');
 const metadata={name:`Butterfly 7777 #${id} · ${family}`,description:'Original nature-inspired generative butterfly artwork. A fixed collection of 7,777 unique editions, inspired by 12 natural butterfly families; artistic interpretations, not scientific specimens.',image:`${base}/art/${id}.jpg`,external_url:`${base.replace(/\/nft$/,'')}/?view=nft&token=${id}`,attributes:[{trait_type:'Family',value:family},{trait_type:'Inspiration',value:palette},{trait_type:'Wings',value:shape},{trait_type:'Pattern',value:pattern},{trait_type:'Rarity',value:rarity}],properties:{edition:id,artwork_sha256:dna,generator:VERSION}};
 const theme=companyTheme(id);
 item.familyEn=palette.replace(/-inspired$/,'');item.nameEn=`${theme.nameEn} · ${item.familyEn} #${String(id).padStart(4,'0')}`;
 item.theme=theme;item.name=`${theme.name} · ${family} #${String(id).padStart(4,'0')}`;
 metadata.name=`Butterfly #${id} · ${theme.nameEn} | ${theme.name} · ${family}`;
 metadata.description+=' 500 company-inspired themes with 15 unique butterflies each, plus 277 Butterfly originals. Independent artwork: no affiliation, endorsement, equity, dividends or company rights. Company names and reference symbols identify creative themes only.';
 metadata.attributes.push(...themeAttributes(theme));metadata.properties.theme_snapshot=snapshot.version;metadata.properties.mapping_version=mappingVersion;metadata.properties.localization={zh:{name:item.name},en:{name:item.nameEn}};
 return{art,item,metadata};
}
export async function generate(output=resolve(ROOT,'public/nft')){

 const configuredBase=process.env.NFT_ASSET_BASE_URL?.replace(/\/$/,'');
 if(configuredBase&&!/^https:\/\/[^/]+\/nft(?:\/[a-zA-Z0-9_-]+)*$/.test(configuredBase))throw Error('NFT_ASSET_BASE_URL must be an absolute HTTPS /nft path');
 const oldManifest=existsSync(`${output}/manifest.json`)?JSON.parse(readFileSync(`${output}/manifest.json`)):null;
 const cacheVersion=existsSync(`${output}/art-version.txt`)?readFileSync(`${output}/art-version.txt`,'utf8'):oldManifest?.version;
 if(cacheVersion!==VERSION){rmSync(`${output}/art`,{recursive:true,force:true});rmSync(`${output}/metadata`,{recursive:true,force:true});}
 mkdirSync(`${output}/art`,{recursive:true});mkdirSync(`${output}/metadata`,{recursive:true});mkdirSync(`${output}/integrity`,{recursive:true});
 writeFileSync(`${output}/art-version.txt`,VERSION);
 const workerCount=4;
 await Promise.all(Array.from({length:workerCount},(_,index)=>new Promise((resolve,reject)=>{const worker=new Worker(new URL('./nft-art/raster-worker.mjs',import.meta.url),{workerData:{index,count:workerCount,output}});worker.once('error',reject);worker.once('exit',code=>code===0?resolve():reject(Error(`Raster worker exit ${code}`)));})));
 const catalog=[],seen=new Set(),rarityCounts={},familyCounts={};
 for(let id=1;id<=SUPPLY;id++){
  const{art,item,metadata}=makeNFT(id);if(seen.has(item.dna))throw Error(`Duplicate artwork ${id}`);seen.add(item.dna);
  const path=`${output}/art/${id}.jpg`;let png;
  png=readFileSync(path);
  const proof=JSON.parse(readFileSync(`${output}/integrity/${id}.json`));
  if(proof.artwork_sha256!==item.dna||proof.image_sha256!==hash(png))throw Error(`Raster integrity failed ${id}`);
  metadata.properties.image_sha256=hash(png);item.imageHash=hash(png);
  catalog.push(item);rarityCounts[item.rarity]=(rarityCounts[item.rarity]||0)+1;familyCounts[item.family]=(familyCounts[item.family]||0)+1;
  writeFileSync(`${output}/metadata/${id}.json`,JSON.stringify(metadata));
  if(id%1000===0)console.log(`Nature artwork ${id}/${SUPPLY}`);
 }
 const manifest={mappingVersion,specialIds,themeVersion:snapshot.version,companyThemes:500,editionsPerCompany:15,originalEditions:277,version:VERSION,supply:SUPPLY,uniqueArtworkHashes:seen.size,collectionHash:hash(catalog.map(x=>x.dna).join('\n')),imageCollectionHash:hash(catalog.map(x=>x.imageHash).join('\n')),rarityCounts,familyCounts,artFormat:'JPEG',width:640,height:640,metadataBase:makeNFT(1).metadata.image.replace('/art/1.jpg','/metadata/'),hosting:configuredBase?'Configured absolute HTTPS hosting; permanence requires continued hosting.':'Deployment-local artwork URLs; mainnet deployment requires a stable public asset host.',license:'Original artwork, Butterfly 7777 project'};
 writeFileSync(`${output}/metadata/collection.json`,JSON.stringify({name:'Butterfly 7777 · Company & Nature Edition',description:'7,777 original nature-inspired butterflies. Zero marketplace fees.',image:makeNFT(7777).metadata.image,external_link:makeNFT(1).metadata.external_url,seller_fee_basis_points:0,fee_recipient:'0x0000000000000000000000000000000000000000'}));
 writeFileSync(`${output}/special-ids.json`,JSON.stringify({version:mappingVersion,count:specialIds.length,ids:specialIds}));
 writeFileSync(`${output}/companies.json`,JSON.stringify(snapshot));
 const csvCell=value=>'"'+String(value).replaceAll('"','""')+'"';
 writeFileSync(`${output}/companies.csv`,'\uFEFF'+[['Theme Rank','Company','Ticker','Source Rank','Snapshot'],...snapshot.companies.map(c=>[c.rank,c.name,c.ticker,c.sourceRank,snapshot.version])].map(row=>row.map(csvCell).join(',')).join('\r\n'));
 writeFileSync(`${output}/catalog.json`,JSON.stringify(catalog));writeFileSync(`${output}/manifest.json`,JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest));return manifest;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await generate();

