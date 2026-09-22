import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {fileURLToPath} from 'node:url';

const repo=fileURLToPath(new URL('../../',import.meta.url));
const out=path.join(repo,'nft/dual-release/assets');
const limit=Number(process.env.ART_LIMIT||7777);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const scenes=[['月桥','Moon Bridge'],['桂庭','Osmanthus Court'],['星渡','Star Crossing'],['云台','Cloud Terrace'],['灯河','Lantern River'],['玉阶','Jade Steps'],['花汀','Flower Shore'],['清池','Quiet Pool'],['蝶谷','Butterfly Valley'],['银湾','Silver Bay'],['秋山','Autumn Mountain'],['梦洲','Dream Island'],['归亭','Homecoming Pavilion']];
const deeds=[['收起一封迟来的家书','gathers a letter that arrived late'],['为远行者点亮归途','lights the way for a distant traveler'],['把乡愁系在桂枝上','ties a longing for home to an osmanthus branch'],['替失眠的人守住月光','keeps moonlight for someone who cannot sleep'],['送一盏灯穿过云海','sends a lantern across the sea of clouds'],['将离别编成重逢的结','weaves a farewell into a knot of reunion'],['为迷路的蝴蝶指路','guides a butterfly that has lost its way'],['把童年的歌谣藏入风中','places a childhood song in the wind'],['让最后一朵秋花盛开','helps the last autumn flower bloom'],['把旧日约定送回人间','returns an old promise to the human world'],['为未归的人留一席月色','keeps a place in the moonlight for someone absent'],['替河畔的小灯挡住夜风','shelters a riverside lantern from the night wind'],['将团圆的祝愿写入星河','writes a wish for reunion among the stars']];
const gifts=[['桂香','osmanthus fragrance'],['星砂','stardust'],['玉露','jade dew'],['锦书','a silk letter'],['莲灯','a lotus lantern'],['蝶羽','a butterfly wing'],['银铃','a silver bell'],['月饼','a mooncake'],['花簪','a flower pin'],['云绢','a cloud ribbon'],['秋叶','an autumn leaf'],['玉笛','a jade flute'],['金穗','a golden tassel']];
export function traits(key,id){
 const bases=key==='change'?5:9,capacity=bases*13*13*13;
 let n=((id-1)*7919+137)%capacity;
 const base=n%bases;n=Math.floor(n/bases);
 const scene=n%13;n=Math.floor(n/13);const deed=n%13;const gift=Math.floor(n/13)%13;
 return {base,scene,deed,gift};
}
function frame(t){
 const gold='#e8bf78',pink='#e6aec9';
 let marks='';
 for(let i=0;i<13;i++){
  const x=62+i*43;
  marks+=`<circle cx="${x}" cy="18" r="${i===t.scene?5:1.6}" fill="${gold}" opacity="${i===t.scene?1:0.45}"/>`;
 }
 // Ornament geometry changes, never the original illustration pixels or hue.
 for(let j=0;j<=t.deed;j++){
  const y=68+j*40;
  marks+=`<path d="M16 ${y-6} L22 ${y} L16 ${y+6} L10 ${y}Z" fill="${pink}" opacity=".8"/>`;
 }
 for(let j=0;j<=t.gift;j++){
  const y=68+j*40;
  marks+=`<path d="M621 ${y}q-12 -16 -13 -5q-1 8 13 5q12 -16 13 -5q1 8 -13 5" fill="${gold}"/>`;
 }
 const phases=Array.from({length:13},(_,i)=>`<circle cx="${62+i*43}" cy="621" r="${i===t.gift?5:2}" fill="${i===t.gift?pink:gold}" opacity=".8"/>`).join('');
 return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><rect x="27" y="27" width="586" height="586" rx="4" fill="none" stroke="${gold}" stroke-width="1.5"/><rect x="5" y="5" width="630" height="630" rx="12" fill="none" stroke="${gold}" opacity=".4"/>${marks}${phases}</svg>`);
}
const all={};
await fs.mkdir(out,{recursive:true});
for(const [key,folder,count] of [['change','nft',5],['rabbit','rabbit-nft',9]]){
 await fs.mkdir(`${out}/${key}/images`,{recursive:true});await fs.mkdir(`${out}/${key}/metadata`,{recursive:true});
 const bases=await Promise.all(Array.from({length:count},(_,i)=>sharp(`${repo}dist/${folder}/independent/${i+1}.webp`).resize(576,576,{fit:'contain'}).png().toBuffer()));
 const records=Array(limit),seen=new Set();let next=1,done=0;
 async function work(){while(next<=limit){const id=next++,t=traits(key,id),signature=JSON.stringify(t);if(seen.has(signature))throw Error('duplicate traits');seen.add(signature);
  const buffer=await sharp({create:{width:640,height:640,channels:3,background:'#1c1228'}}).composite([{input:bases[t.base],top:32,left:32},{input:frame(t)}]).webp({quality:88,effort:0}).toBuffer();
  const actor=key==='change'?'嫦娥':'玉兔',actorEn=key==='change'?"Chang’e":'Jade Rabbit';
  const title=`${scenes[t.scene][0]}·${gifts[t.gift][0]}·${t.deed+1}`;
  const story=`第${t.base+1}卷，${actor}来到${scenes[t.scene][0]}，${deeds[t.deed][0]}。临别时，一位旅人留下${gifts[t.gift][0]}：愿每一份思念都有人接住。`;
  const en=`In chapter ${t.base+1}, ${actorEn} arrives at ${scenes[t.scene][1]} and ${deeds[t.deed][1]}. A traveler leaves ${gifts[t.gift][1]} as a wish that every longing will find a home.`;
  const attributes=Object.entries(t).map(([trait_type,value])=>({trait_type,value:value+1}));
  const meta={name:`${actorEn} #${id} — ${scenes[t.scene][1]}`,description:en+' A compositional edition made from existing artwork; stories are assembled from narrative traits.',image:`../images/${id}.webp`,external_url:`https://zhongqiu.sh/${folder}/?id=${id}`,attributes,properties:{title_zh:title,story_zh:story,artwork:'Compositional edition',image_sha256:hash(buffer)}};
  await fs.writeFile(`${out}/${key}/images/${id}.webp`,buffer);await fs.writeFile(`${out}/${key}/metadata/${id}.json`,JSON.stringify(meta));
  records[id-1]={id,...t,title,story,story_en:en,sha256:hash(buffer)};
  if(++done%500===0)console.log(`${key} ${done}/${limit}`);
 }}
 await Promise.all(Array.from({length:4},work));
 if(new Set(records.map(x=>x.sha256)).size!==limit)throw Error('duplicate image');
 if(new Set(records.map(x=>x.story)).size!==limit)throw Error('duplicate story');
 await fs.writeFile(`${out}/${key}/catalog.json`,JSON.stringify(records));all[key]={count:limit,originals:count,catalogSha256:hash(JSON.stringify(records))};
}
await fs.writeFile(`${out}/manifest.json`,JSON.stringify({version:1,priceBNB:'0.001',artwork:'Compositional editions; original colors preserved',collections:all},null,2));
console.log('Complete',JSON.stringify(all));
