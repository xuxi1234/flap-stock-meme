import {readFileSync} from 'node:fs';
export const snapshot=JSON.parse(readFileSync(new URL('../data/nft-companies.json',import.meta.url),'utf8'));
const aliases={NVDA:'英伟达',AAPL:'苹果',GOOGL:'谷歌 Alphabet',MSFT:'微软',AMZN:'亚马逊',SPCX:'SpaceX',TSM:'台积电',META:'Meta',AVGO:'博通',TSLA:'特斯拉',MU:'美光','BRK.B':'伯克希尔·哈撒韦',LLY:'礼来',JPM:'摩根大通',SKHY:'SK 海力士',AMD:'超威半导体',WMT:'沃尔玛',V:'Visa',XOM:'埃克森美孚',JNJ:'强生',ASML:'阿斯麦',INTC:'英特尔',MA:'万事达',ABBV:'艾伯维',ORCL:'甲骨文',CSCO:'思科',PLTR:'Palantir',CVX:'雪佛龙',BAC:'美国银行',COST:'好市多',KO:'可口可乐',DELL:'戴尔',CAT:'卡特彼勒',MRK:'默沙东',HSBC:'汇丰',PG:'宝洁',LRCX:'泛林集团',UNH:'联合健康',AMAT:'应用材料',GE:'通用电气航空',MS:'摩根士丹利',NFLX:'奈飞',HD:'家得宝',GS:'高盛',ARM:'Arm',BABA:'阿里巴巴',WFC:'富国银行',AZN:'阿斯利康',SAP:'思爱普',TXN:'德州仪器',TM:'丰田',IBM:'IBM',C:'花旗',QCOM:'高通',CRM:'Salesforce',NVO:'诺和诺德',PEP:'百事',DIS:'迪士尼',MCD:'麦当劳',PFE:'辉瑞',BA:'波音',UBER:'优步',SONY:'索尼',PDD:'拼多多',SBUX:'星巴克',SPOT:'Spotify',SMCI:'超微电脑',LVS:'拉斯维加斯金沙'};
export const requestedSpecialIds=[1,2,3,4,5,6,7,8,9,10,11,16,18,17,66,33,88,99,100,101,108,111,1111,2222,7777,6666,5555,4444,3333,520,1314,1688];
// Fixed deterministic curation, never used to alter the on-chain draw probabilities.
function score(id){const s=String(id);let points=0;
 if(new Set(s).size===1)points+=10000+s.length*100;
 if(s.length>=3&&s===s.split('').reverse().join(''))points+=3000;
 if(s.length===4&&s.slice(0,2)===s.slice(2))points+=5000;
 if(s.length===4&&s[0]===s[1]&&s[2]===s[3])points+=4000;
 if(s.length>=3&&('123456789'.includes(s)||'987654321'.includes(s)))points+=6000;
 if(id%1000===0)points+=7000;else if(id%100===0)points+=2000;
 if(/(?:168|518|520|666|777|888)$/.test(s))points+=1500;
 if(id<=100)points+=1000;
 return points;}
const chosen=new Set(requestedSpecialIds);
for(const id of Array.from({length:7777},(_,i)=>i+1).filter(id=>!chosen.has(id)).sort((a,b)=>score(b)-score(a)||a-b)){if(chosen.size===277)break;chosen.add(id)}
export const specialIds=[...chosen].sort((a,b)=>a-b);
export const mappingVersion='lucky-277-v1';
const specialEdition=new Map(specialIds.map((id,index)=>[id,index+1]));
const ordinaryIndex=new Map(Array.from({length:7777},(_,i)=>i+1).filter(id=>!chosen.has(id)).map((id,index)=>[id,index]));
export function companyTheme(id){
 if(!Number.isInteger(id)||id<1||id>7777)throw Error('Invalid NFT ID');
 if(specialEdition.has(id))return{kind:'original',name:'蝴蝶股票原创特别款',nameEn:'Butterfly Originals',ticker:'FLAP STOCK',edition:specialEdition.get(id),total:277,snapshot:snapshot.version,mapping:mappingVersion};
 const index=ordinaryIndex.get(id);const company=snapshot.companies[index%500];
 return{kind:'company',name:aliases[company.ticker]||company.name,legalName:company.name,ticker:company.ticker,nameEn:company.name,rank:company.rank,mapping:mappingVersion,edition:Math.floor(index/500)+1,total:15,snapshot:snapshot.version};
}
export const themeAttributes=theme=>[
 {trait_type:'Collection Series',value:theme.kind==='company'?'Company Inspiration':'Butterfly Originals'},
 {trait_type:'Company Theme',value:theme.nameEn||theme.legalName||theme.name},
 {trait_type:'Reference Symbol',value:theme.ticker},
 {trait_type:'Theme Edition',value:theme.edition},
 {trait_type:'Theme Supply',value:theme.total},
 {trait_type:'Theme Snapshot',value:theme.snapshot},
];
