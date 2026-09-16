import { BOARD_CATEGORIES, BOARD_SORTS, ADDRESS, normalizeBoard, parsePublicBoard, isUnusual, sortBoard, indexedBoard, type BoardCategory, type BoardSort, type BoardSnapshot } from '../src/swap/flapBoard.js'
type Request = { method?: string; query?: Record<string, string | string[] | undefined> }
type Response = { setHeader: (key:string,value:string)=>void; status:(n:number)=>Response; json:(body:unknown)=>void }
const paths: Record<BoardCategory,string> = {trending:'',unusual:'',stocks:'/tag=stocks',bonding:'/graduatinghot',listadao:'/tag=listadao',gifts:'/tag=gifttoken',innovation:'',fac:''}
async function read(url:string, limit:number) {
  const response=await fetch(url,{signal:AbortSignal.timeout(6500),redirect:'error',headers:{Accept:url.includes('/v3/')?'application/json':'text/html'}})
  if(!response.ok)throw Error('Source unavailable')
  const reader=response.body?.getReader();if(!reader)throw Error('Missing body')
  let size=0;const chunks:Uint8Array[]=[]
  try { while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit)throw Error('Response too large');chunks.push(value)} }
  finally { await reader.cancel() }
  const all=new Uint8Array(size);let offset=0;for(const c of chunks){all.set(c,offset);offset+=c.length}return new TextDecoder().decode(all)
}
export default async function handler(req:Request,res:Response){
  if(req.method!=='GET'){res.setHeader('Allow','GET');res.status(405).json({error:'GET required'});return}
  const q=req.query??{},category=q.category??'trending',sort=q.sort??'default',order=q.order??'desc',cursor=q.cursor,quote=q.quote
  if(typeof category!=='string'||!BOARD_CATEGORIES.some(c=>c.id===category)||typeof sort!=='string'||!Object.hasOwn(BOARD_SORTS,sort)||!['asc','desc'].includes(String(order))||typeof order!=='string'||cursor!==undefined&&(typeof cursor!=='string'||cursor.length>512)||quote!==undefined&&(typeof quote!=='string'||!ADDRESS.test(quote))){res.status(400).json({error:'Invalid filters'});return}
  const cat=category as BoardCategory;let result:BoardSnapshot
  try {
    const raw=JSON.parse(await read(`https://raw.githubusercontent.com/xuxi1234/flap-stock-meme/automation/flap-board-data/snapshot.json?minute=${Math.floor(Date.now()/60000)}`,2_000_000))
    result=indexedBoard(raw,cat,sort as BoardSort,order as 'asc'|'desc',quote as string|undefined,cursor as string|undefined)
    res.setHeader('Cache-Control','public, s-maxage=15, stale-while-revalidate=15');res.status(200).json(result);return
  } catch { /* Preserve the independently available sources if the index is unavailable. */ }
  if(typeof cursor==='string'&&cursor.startsWith('index:')){res.status(503).json({error:'链上快照暂不可用，请重试。'});return}
  try{
    const params=new URLSearchParams({limit:'40'})
    if(sort!=='default'){params.set('sortBy',sort);params.set('order',order)}
    if(cursor)params.set('cursor',cursor as string)
    if(quote)params.set('quoteToken',quote as string)
    if(cat==='innovation')params.set('isInnovation','true')
    if(cat==='fac')params.set('isLowRisk','true')
    try{
      const raw=JSON.parse(await read(`https://bnb.taxed.fun/v3/board${paths[cat]}?${params}`,700_000))
      const board=normalizeBoard(raw)
      result={...board,category:cat,fetchedAt:Date.now(),source:'api',scope:'Flap 实时分类数据；分类与指标由 Flap 提供。'}
    }catch{
      // This separate public page is available without login. It exposes only its first trending page.
      if(cursor||!['trending','unusual','fac','innovation'].includes(cat))throw Error('Category unavailable')
      const page=await read('https://flap.sh/board?lang=zh',2_000_000)
      const parsed=parsePublicBoard(page) as { sourceUpdatedAt?: number };const board=normalizeBoard(parsed)
      let items=board.items
      if(cat==='fac')items=items.filter(r=>r.fac)
      if(cat==='innovation')items=items.filter(r=>r.innovation)
      if(quote)items=items.filter(r=>r.quoteAddress===String(quote).toLowerCase())
      result={category:cat,items:sortBoard(items,sort as BoardSort,order as 'asc'|'desc'),nextCursor:null,fetchedAt:Date.now(),source:'page',sourceUpdatedAt:typeof parsed.sourceUpdatedAt==='number'&&Number.isFinite(parsed.sourceUpdatedAt)?parsed.sourceUpdatedAt:undefined,scope:'分类接口暂不可用，当前读取 Flap 公开热门首页并在该范围筛选；不是完整分类或全链排名。'}
    }
    if(cat==='unusual')result.items=result.items.filter(isUnusual)
    res.setHeader('Cache-Control','public, s-maxage=30, stale-while-revalidate=30');res.status(200).json(result)
  }catch{res.setHeader('Cache-Control','no-store');res.status(503).json({error:'Flap 此分类接口暂不可用，请稍后重试或打开原站。'})}
}
