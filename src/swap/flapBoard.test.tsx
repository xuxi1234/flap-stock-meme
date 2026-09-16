import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BUTTERFLY } from './config'
import { BOARD_CATEGORIES, normalizeBoard, parsePublicBoard, isUnusual, sortBoard, indexedBoard } from './flapBoard'
import { FlapBoard } from './FlapBoard'
import handler from '../../api/flap-board'
const address='0x'+'1'.repeat(40), second='0x'+'2'.repeat(40)
const item={coin:{address,name:'Example',symbol:'EX',image:'javascript:alert(1)'},listed:true,price:'0.00000014',marketCap:'140',volume24h:'0',holders:0,liquidity:'10',change5m:'0',change1h:'-10',change4h:null,change24h:'-12',tax:{hasTax:true,buyTaxBps:0,sellTaxBps:100},isLowRisk:true}
const publicPage=(items:unknown[])=>`<script>self.__next_f.push(${JSON.stringify([1,'6:'+JSON.stringify(['$','$L2e',null,{initialBoard:{items,nextCursor:'next'}}])+'\n'])})</script>`
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals()})
it('validates contracts, distinguishes unknown metrics from zero, and bounds tax/holders',()=>{
 const {items}=normalizeBoard({items:[item,item,{...item,coin:{address:'javascript:evil'}},{...item,coin:{address:second},holders:-1,tax:{buyTaxBps:10001},isLowRisk:'true'}]})
 expect(items).toHaveLength(2);expect(items[0]).toMatchObject({price:0.00000014,volume24h:0,holders:0,buyTaxBps:0,change4h:null,image:null,fac:true})
 expect(items[1]).toMatchObject({holders:null,buyTaxBps:null,sellTaxBps:null,fac:false})
 expect(()=>normalizeBoard({error:'blocked'})).toThrow()
})
it('parses public stream JSON without executing source and rejects missing board',()=>{
 expect(normalizeBoard(parsePublicBoard(publicPage([item]))).items[0].address).toBe(address)
 expect(()=>parsePublicBoard('<script>alert(1)</script>')).toThrow()
})
it('uses explicit butterfly anomaly thresholds and keeps missing metrics last in both directions',()=>{
 const a=normalizeBoard({items:[item]}).items[0],b={...a,address:second,volume24h:null,change1h:null}
 expect(isUnusual(a)).toBe(true);expect(isUnusual(b)).toBe(false)
 for(const order of ['asc','desc'] as const)expect(sortBoard([b,a],'volume24h',order)[1].address).toBe(second)
})
it('validates API queries before any network access and never accepts an upstream URL',async()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);const res=response()
 for(const query of [{category:'../admin'},{sort:'toString'},{quote:'https://localhost'},{cursor:['a','b']},{order:['asc']}])await handler({method:'GET',query},res)
 expect(res.status).toHaveBeenCalledWith(400);expect(fetch).not.toHaveBeenCalled()
 await handler({method:'POST'},res);expect(res.status).toHaveBeenCalledWith(405)
})
function response(){const res={setHeader:vi.fn(),status:vi.fn(),json:vi.fn()};res.status.mockReturnValue(res);return res}
it('bounds Flap API requests, validates the response and forwards safe cursor filters',async()=>{
 const fetch=vi.fn().mockImplementation(async()=>new Response(JSON.stringify({items:[item],nextCursor:'next'})));vi.stubGlobal('fetch',fetch)
 const res=response();await handler({method:'GET',query:{category:'fac',sort:'holders',order:'desc',quote:address,cursor:'20|token'}},res)
 const url=new URL(fetch.mock.calls[1][0]);expect(url.origin).toBe('https://bnb.taxed.fun');expect(url.searchParams.get('isLowRisk')).toBe('true');expect(url.searchParams.get('cursor')).toBe('20|token')
 expect(res.json.mock.calls[0][0]).toMatchObject({source:'api',category:'fac',nextCursor:'next'})
})
it('labels bounded public-page fallback and never turns failed categories into empty successful boards',async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(new Response('',{status:404})).mockResolvedValueOnce(new Response('',{status:403})).mockResolvedValueOnce(new Response(publicPage([item,{...item,coin:{address:second},isLowRisk:false}])));vi.stubGlobal('fetch',fetch)
 const res=response();await handler({method:'GET',query:{category:'fac'}},res)
 expect(res.json.mock.calls[0][0]).toMatchObject({source:'page',nextCursor:null,items:[{address}]})
 fetch.mockResolvedValue(new Response('',{status:403}));await handler({method:'GET',query:{category:'bonding'}},res);expect(res.status).toHaveBeenLastCalledWith(503)
})
it('filters, switches card layout, selects an exact contract, and avoids offering internal swaps for bonding tokens',async()=>{
 const rows=normalizeBoard({items:[item,{...item,coin:{address:second,name:'New',symbol:'NEW'},listed:false,progress:42}]}).items
 vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>({ok:true,json:async()=>({category:'trending',items:rows,nextCursor:null,fetchedAt:Date.now(),source:'api',scope:'Flap'})})))
 const onTrade=vi.fn();render(<FlapBoard favorites={[]} onFavorite={vi.fn()} onTrade={onTrade}/>);await screen.findByRole('button',{name:'选择 EX 交易'})
 fireEvent.click(screen.getByRole('button',{name:'选择 EX 交易'}));expect(onTrade).toHaveBeenCalledWith(address)
 expect(screen.queryByRole('button',{name:'选择 NEW 交易'})).not.toBeInTheDocument()
 fireEvent.click(screen.getByRole('button',{name:'卡片视图'}));expect(screen.getAllByRole('article')).toHaveLength(2)
 fireEvent.change(screen.getByLabelText('搜索看板已加载代币'),{target:{value:second}});expect(screen.getAllByRole('article')).toHaveLength(1)
 fireEvent.click(screen.getByRole('button',{name:'FAC 认证'}));await waitFor(()=>expect(screen.queryByText('内盘进度 42.0%')).not.toBeInTheDocument())
})
it('does not render a previous category response after the category has changed',async()=>{
 let resolveFirst:(value:unknown)=>void=()=>{};const first=new Promise(resolve=>{resolveFirst=resolve})
 vi.stubGlobal('fetch',vi.fn().mockReturnValueOnce(first).mockResolvedValue({ok:true,json:async()=>({category:'gifts',items:[],nextCursor:null,fetchedAt:Date.now(),source:'api',scope:'Flap'})}))
 render(<FlapBoard favorites={[]} onFavorite={vi.fn()}/>);fireEvent.click(screen.getByRole('button',{name:'礼物代币'}));await screen.findByText('当前范围没有匹配代币')
 resolveFirst({ok:true,json:async()=>({category:'trending',items:normalizeBoard({items:[item]}).items,fetchedAt:Date.now(),source:'api'})})
 await waitFor(()=>expect(screen.queryByText('EX')).not.toBeInTheDocument())
})

it('keeps the official contract ahead of every category and removes upstream duplicates despite filters and failures',async()=>{
 const items=normalizeBoard({items:[item,{...item,coin:{address:BUTTERFLY.address,name:'duplicate',symbol:'DUPLICATE'}}]}).items
 const fetch=vi.fn().mockImplementation(async(url:string)=>({ok:true,json:async()=>({category:new URL(url,'https://example.com').searchParams.get('category'),items,nextCursor:null,fetchedAt:Date.now(),source:'api',scope:'Flap'})}));vi.stubGlobal('fetch',fetch)
 const onTrade=vi.fn();render(<FlapBoard favorites={[]} onFavorite={vi.fn()} onTrade={onTrade}/>)
 for(const c of BOARD_CATEGORIES){
  fireEvent.click(screen.getByRole('button',{name:c.label}));await screen.findByRole('button',{name:'选择 EX 交易'})
  const pin=screen.getByRole('region',{name:'蝴蝶股票官方置顶'})
  expect(pin).toHaveTextContent(BUTTERFLY.address);expect(pin.compareDocumentPosition(screen.getByRole('table'))&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.queryByRole('button',{name:'选择 DUPLICATE 交易'})).not.toBeInTheDocument()
 }
 fireEvent.click(screen.getByRole('button',{name:'卡片视图'}));fireEvent.click(screen.getByRole('button',{name:'☆ 收藏'}));fireEvent.change(screen.getByLabelText('搜索看板已加载代币'),{target:{value:'no-match'}})
 fireEvent.change(screen.getByLabelText('Flap 排行排序'),{target:{value:'marketcap'}})
 expect(screen.getByRole('region',{name:'蝴蝶股票官方置顶'})).toBeInTheDocument()
 fetch.mockResolvedValue({ok:false});fireEvent.click(screen.getByRole('button',{name:'热门'}));await screen.findByRole('alert')
 fireEvent.click(screen.getByRole('button',{name:'交易蝴蝶股票 ↗'}));expect(onTrade).toHaveBeenCalledWith(BUTTERFLY.address)
})

it('serves true chain categories, flags stale snapshots and rejects expired data',()=>{
 const raw={version:1,chainId:56,updatedAt:Date.now()-240000,block:123,records:[{...item,tags:['trending','stocks']},{...item,coin:{address:second},tags:['trending','gifts']}]};
 expect(indexedBoard(raw,'stocks','default','desc')).toMatchObject({source:'index',stale:true,items:[{address}]});
 expect(indexedBoard(raw,'listadao','default','desc').items).toHaveLength(0);
 expect(()=>indexedBoard({...raw,updatedAt:Date.now()-90000000},'stocks','default','desc')).toThrow();
 expect(()=>indexedBoard(raw,'stocks','default','desc',undefined,'upstream-cursor')).toThrow();
});
it('uses the persistent snapshot before upstream and preserves the actual source time',async()=>{
 const updatedAt=Date.now()-90000;
 const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({version:1,chainId:56,updatedAt,block:123,records:[{...item,tags:['stocks']}]})));vi.stubGlobal('fetch',fetch);
 const res=response();await handler({method:'GET',query:{category:'stocks'}},res);
 expect(fetch).toHaveBeenCalledTimes(1);expect(res.json.mock.calls[0][0]).toMatchObject({source:'index',sourceUpdatedAt:updatedAt,items:[{address}]});
});
it('keeps same-category rows visible when a refresh fails',async()=>{
 const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({category:'trending',items:normalizeBoard({items:[item]}).items,nextCursor:null,fetchedAt:Date.now(),source:'index',scope:'chain'})});vi.stubGlobal('fetch',fetch);
 render(<FlapBoard favorites={[]} onFavorite={vi.fn()}/>);await screen.findByText('EX');
 fetch.mockResolvedValue({ok:false});fireEvent.click(screen.getByRole('button',{name:'刷新 Flap 看板'}));
 await screen.findByText('更新暂时失败，保留上次成功数据');expect(screen.getByText('EX')).toBeInTheDocument();
});
