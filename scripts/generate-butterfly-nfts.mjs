import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

export const SUPPLY = 7777;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PALETTES = [
  ['翡翠星云','Emerald','#baff2a','#10dfac','#042b22'],
  ['紫晶幻境','Amethyst','#e7abff','#8858f5','#240839'],
  ['冰川蓝调','Glacier','#e3ffff','#36bcec','#072941'],
  ['鎏金日蚀','Solar','#ffe6a2','#ed9b28','#362007'],
  ['绯红玫瑰','Crimson','#ffb8dc','#fb427d','#400d28'],
  ['月光银翼','Moonlight','#ffffff','#b1c5da','#1c273f'],
  ['琥珀流火','Ember','#ffe28c','#ff7449','#441a0f'],
  ['极光之境','Aurora','#a5ffcf','#7597ff','#112739'],
  ['电光幽蓝','Electric','#b5cdff','#5861ff','#15134a'],
  ['桃金晨曦','Dawn','#fff0c5','#f49caf','#3b2336'],
];
const WINGS = ['凤尾','月蛾','燕尾','帝王','幻羽','流星'];
const PATTERNS = ['星脉','晶格','眼纹','流光','星尘'];
const HALOS = ['轨道','日轮','星环','双月'];
const hash = x => createHash('sha256').update(x).digest('hex');
function rng(seed) { let s=seed>>>0; return () => {s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;}; }
const n=x=>Number(x.toFixed(2));

export function makeNFT(id) {
  if (!Number.isInteger(id)||id<1||id>SUPPLY) throw Error('Invalid edition');
  const seed=hash(`butterfly-7777-original-art-v1:${id}`), r=rng(parseInt(seed.slice(0,8),16));
  const pick=a=>a[Math.floor(r()*a.length)];
  const palette=pick(PALETTES), wing=Math.floor(r()*WINGS.length), pattern=Math.floor(r()*PATTERNS.length), halo=Math.floor(r()*HALOS.length);
  const rarityDraw=r(); const rarity=rarityDraw<0.025?'传说':rarityDraw<0.125?'史诗':rarityDraw<0.4?'稀有':'典藏';
  const [family,,light,color,dark]=palette;
  const topX=n(185+r()*60),topY=n(-210+r()*45),width=n(215+r()*30),lower=n(105+r()*48),tail=n(175+r()*70);
  const lowerWing=wing===3
    ?`Q ${width-46} 112 ${width-63} ${lower-8} Q ${width-88} ${lower+28} 128 ${lower+2} Q 82 ${lower+38} 55 116`
    :wing===5
      ?`Q ${width-30} 128 ${width-24} ${lower+18} L 92 ${tail+34} Q 73 ${tail+42} 68 125`
      :`Q ${width-50} 119 ${wing%2?width-81:width-40} ${lower} Q ${wing===1?75:width-65} ${lower-10} ${wing===0||wing===2?110:75} ${wing===0||wing===2?tail:lower+15} Q ${wing===0||wing===2?87:44} ${wing===0||wing===2?tail+20:lower+22} 68 125`;
  const path=`M 8 -6 C 40 -85 ${n(topX*.65)} ${topY-45} ${topX} ${topY} C ${width+35} ${topY+35} ${width+14} -64 ${width-25} -23 C ${width-65} 15 104 31 20 13 C 115 5 ${width-5} 17 ${width-38} 86 ${lowerWing} C 21 96 9 58 8 -6 Z`;
  let cells='',stars='',haloArt='';
  for(let i=0;i<13;i++) {
    const x=n(45+i*14+r()*15),y=n(-155+(i%4)*31+r()*21);
    cells+=`<path d="M 13 2 Q ${n(x*.45)} ${y*.9} ${x} ${y} Q ${x+25} ${y-35} ${x+35} ${y-24}" fill="none" stroke="${light}" stroke-width="${n(.6+r())}" opacity=".5"/>`;
    cells+=`<path d="M 14 10 Q ${x*.45} ${45+i*4} ${x} ${55+i*5}" fill="none" stroke="${light}" opacity=".28"/>`;
  }
  for(let i=0;i<31;i++){
    const a=r()*Math.PI*2, d=35+r()*220;
    stars+=`<circle cx="${n(320+Math.cos(a)*d)}" cy="${n(310+Math.sin(a)*d)}" r="${n(.5+r()*1.3)}" fill="${light}" opacity="${n(.12+r()*.48)}"/>`;
  }
  for(let i=0;i<25;i++){
    const x=n(40+r()*196),y=n(-190+r()*310),size=n(1.1+r()*3.6);
    if(pattern===1)cells+=`<path d="M ${x} ${y-size*2} l ${size} ${size*2} l ${-size} ${size*2} l ${-size} ${-size*2} Z" fill="${light}" opacity=".45"/>`;
    else if(pattern===3)cells+=`<path d="M ${x-size*4} ${y+size*2} Q ${x} ${y-size*2} ${x+size*5} ${y-size*5}" fill="none" stroke="${light}" stroke-width="${n(size*.65)}" stroke-linecap="round" opacity=".55"/>`;
    else if(pattern===4)cells+=`<path d="M ${x-size*2} ${y} H ${x+size*2} M ${x} ${y-size*2} V ${y+size*2} M ${x-size*1.4} ${y-size*1.4} L ${x+size*1.4} ${y+size*1.4} M ${x+size*1.4} ${y-size*1.4} L ${x-size*1.4} ${y+size*1.4}" fill="none" stroke="${light}" stroke-width="${n(size*.38)}" opacity=".65"/>`;
    else cells+=`<circle cx="${x}" cy="${y}" r="${size}" fill="${light}" opacity="${n(.18+r()*.5)}"/>`;
  }
  if(pattern===2||pattern===0){
    for(const [x,y,s] of [[168,-100,25],[120,75,19]]) cells+=`<ellipse cx="${x}" cy="${y}" rx="${s*1.1}" ry="${s}" fill="${dark}" stroke="${light}" stroke-width="1.5"/><ellipse cx="${x}" cy="${y}" rx="${s*.7}" ry="${s*.67}" fill="url(#eye)"/><circle cx="${x+3}" cy="${y-3}" r="${s*.28}" fill="${dark}"/><circle cx="${x+6}" cy="${y-7}" r="2" fill="white"/>`;
  }
  for(let i=0;i<3;i++)haloArt+=`<circle cx="320" cy="310" r="${238+i*11}" stroke="${color}" stroke-width="${i===1?.7:.4}" stroke-dasharray="${halo===1?'1 6':halo===2?'30 12':i===1?'2 9':'900 100'}" fill="none" opacity="${i===1?.35:.15}"/>`;
  if(halo===3)haloArt+=`<circle cx="320" cy="310" r="215" fill="none" stroke="${color}" stroke-width=".8" opacity=".15" transform="translate(-100 0)"/><circle cx="320" cy="310" r="215" fill="none" stroke="${color}" opacity=".15" transform="translate(100 0)"/>`;
  const art=`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 640 640"><defs><radialGradient id="bg"><stop stop-color="${dark}"/><stop offset="1" stop-color="#080b0c"/></radialGradient><linearGradient id="wing" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${light}"/><stop offset=".27" stop-color="${color}"/><stop offset=".55" stop-color="${dark}"/><stop offset=".8" stop-color="${color}"/><stop offset="1" stop-color="${light}"/></linearGradient><radialGradient id="eye"><stop stop-color="${light}"/><stop offset=".5" stop-color="${color}"/><stop offset="1" stop-color="${dark}"/></radialGradient><linearGradient id="body"><stop stop-color="#090d0d"/><stop offset=".45" stop-color="${light}"/><stop offset=".65" stop-color="${color}"/><stop offset="1" stop-color="#050b0c"/></linearGradient><clipPath id="clip"><path d="${path}"/></clipPath><filter id="glow"><feGaussianBlur stdDeviation="3"/></filter></defs><rect width="640" height="640" fill="url(#bg)"/>${haloArt}${stars}<g transform="translate(320 306) rotate(${n(-5+r()*10)})"><g id="half"><path d="${path}" fill="${color}" opacity=".28" filter="url(#glow)"/><path d="${path}" fill="url(#wing)" stroke="${light}" stroke-width="1.5"/><g clip-path="url(#clip)">${cells}<path d="M 14 0 Q 103 -22 240 -155 M 13 2 Q 117 -95 208 -187 M 14 3 Q 149 -2 240 -57 M 15 12 Q 96 52 163 114" stroke="${light}" stroke-width="1" fill="none" opacity=".65"/><path d="M 24 3 Q 130 -140 224 -156 Q 165 -65 24 3" fill="${light}" opacity=".13"/></g></g><use href="#half" transform="scale(-1 1)"/><ellipse cy="21" rx="9" ry="66" fill="url(#body)"/><ellipse cy="-36" rx="12" ry="17" fill="url(#body)"/><path d="M -6 -45 Q -25 -79 -43 -81 M 6 -45 Q 25 -79 43 -81" fill="none" stroke="${light}" stroke-width="1.4"/><circle cx="-43" cy="-81" r="3" fill="${light}"/><circle cx="43" cy="-81" r="3" fill="${light}"/></g><path d="M 30 52 V 30 H 52 M 588 30 H 610 V 52 M 30 588 V 610 H 52 M 588 610 H 610 V 588" fill="none" stroke="${color}" opacity=".5"/><path d="M 314 44 L 320 34 L 326 44 L 320 54 Z" fill="${color}" opacity=".7"/></svg>`;
  const dna=hash(art);
  const item={id,name:`${family} #${String(id).padStart(4,'0')}`,family,palette:palette[1],color,rarity,wing:WINGS[wing],pattern:PATTERNS[pattern],halo:HALOS[halo],dna,image:`/nft/art/${id}.svg`};
  const metadata={name:`Butterfly 7777 #${id}`,description:'An original generative butterfly from a fixed collection of 7,777 unique editions. Preview art; no token has been minted on-chain by this preview.',image:`../art/${id}.svg`,external_url:`/?view=nft&token=${id}`,attributes:[{trait_type:'Family',value:family},{trait_type:'Wings',value:item.wing},{trait_type:'Pattern',value:item.pattern},{trait_type:'Halo',value:item.halo},{trait_type:'Rarity',value:rarity}],properties:{edition:id,artwork_sha256:dna,generator:'butterfly-7777-original-art-v1'}};
  return {art,item,metadata};
}

export function generate(output=resolve(ROOT,'public/nft')) {
  mkdirSync(`${output}/art`,{recursive:true});mkdirSync(`${output}/metadata`,{recursive:true});
  const catalog=[], seen=new Set(), rarityCounts={};
  for(let id=1;id<=SUPPLY;id++){
    const {art,item,metadata}=makeNFT(id);
    if(seen.has(item.dna))throw Error(`Duplicate artwork at ${id}`);
    seen.add(item.dna); catalog.push(item);rarityCounts[item.rarity]=(rarityCounts[item.rarity]||0)+1;
    writeFileSync(`${output}/art/${id}.svg`,art);writeFileSync(`${output}/metadata/${id}.json`,JSON.stringify(metadata));
  }
  const manifest={version:1,supply:SUPPLY,uniqueArtworkHashes:seen.size,collectionHash:hash(catalog.map(x=>x.dna).join('\n')),rarityCounts,artFormat:'SVG',license:'Original artwork, Butterfly 7777 project',hosting:'Preview-relative metadata; freeze absolute immutable URIs before on-chain deployment'};
  writeFileSync(`${output}/catalog.json`,JSON.stringify(catalog));writeFileSync(`${output}/manifest.json`,JSON.stringify(manifest,null,2));
  console.log(JSON.stringify(manifest));return manifest;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))generate();
