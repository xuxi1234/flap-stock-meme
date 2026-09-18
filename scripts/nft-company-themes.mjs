import {readFileSync} from 'node:fs';
export const snapshot=JSON.parse(readFileSync(new URL('../data/nft-companies.json',import.meta.url),'utf8'));
const aliases={NVDA:'英伟达',AAPL:'苹果',GOOGL:'谷歌 Alphabet',MSFT:'微软',AMZN:'亚马逊',SPCX:'SpaceX',TSM:'台积电',META:'Meta',AVGO:'博通',TSLA:'特斯拉',MU:'美光','BRK.B':'伯克希尔·哈撒韦',LLY:'礼来',JPM:'摩根大通',SKHY:'SK 海力士',AMD:'超威半导体',WMT:'沃尔玛',V:'Visa',XOM:'埃克森美孚',JNJ:'强生',ASML:'阿斯麦',INTC:'英特尔',MA:'万事达',ABBV:'艾伯维',ORCL:'甲骨文',CSCO:'思科',PLTR:'Palantir',CVX:'雪佛龙',BAC:'美国银行',COST:'好市多',KO:'可口可乐',DELL:'戴尔',CAT:'卡特彼勒',MRK:'默沙东',HSBC:'汇丰',PG:'宝洁',LRCX:'泛林集团',UNH:'联合健康',AMAT:'应用材料',GE:'通用电气航空',MS:'摩根士丹利',NFLX:'奈飞',HD:'家得宝',GS:'高盛',ARM:'Arm',BABA:'阿里巴巴',WFC:'富国银行',AZN:'阿斯利康',SAP:'思爱普',TXN:'德州仪器',TM:'丰田',IBM:'IBM',C:'花旗',QCOM:'高通',CRM:'Salesforce',NVO:'诺和诺德',PEP:'百事',DIS:'迪士尼',MCD:'麦当劳',PFE:'辉瑞',BA:'波音',UBER:'优步',SONY:'索尼',PDD:'拼多多',SBUX:'星巴克',SPOT:'Spotify',SMCI:'超微电脑',LVS:'拉斯维加斯金沙'};
export function companyTheme(id){
 if(!Number.isInteger(id)||id<1||id>7777)throw Error('Invalid NFT ID');
 if(id>7500)return{kind:'original',name:'蝴蝶股票原创特别款',ticker:'FLAP STOCK',edition:id-7500,total:277,snapshot:snapshot.version};
 const company=snapshot.companies[(id-1)%500];
 return{kind:'company',name:aliases[company.ticker]||company.name,legalName:company.name,ticker:company.ticker,rank:company.rank,edition:Math.floor((id-1)/500)+1,total:15,snapshot:snapshot.version};
}
export const themeAttributes=theme=>[
 {trait_type:'Collection Series',value:theme.kind==='company'?'Company Inspiration':'Butterfly Originals'},
 {trait_type:'Company Theme',value:theme.legalName||theme.name},
 {trait_type:'Reference Symbol',value:theme.ticker},
 {trait_type:'Theme Edition',value:theme.edition},
 {trait_type:'Theme Supply',value:theme.total},
 {trait_type:'Theme Snapshot',value:theme.snapshot},
];
