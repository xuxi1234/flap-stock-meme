import { afterEach, expect, it, vi } from 'vitest'
import { normalizeTrades } from './trades'
import { BUTTERFLY, TOKENS } from './config'
import { normalizeMarkets } from './marketData'
import handler from '../../api/swap-trades'
const hash='0x'+'1'.repeat(64),pair='0x'+'2'.repeat(40)
const item={id:'event-1',attributes:{tx_hash:hash,block_timestamp:'2026-09-15T12:00:00Z',from_token_amount:'1.25',to_token_amount:'12345.123456789',from_token_address:TOKENS[6].address,to_token_address:BUTTERFLY.address,volume_in_usd:'900'}}
afterEach(()=>vi.unstubAllGlobals())
it('uses token addresses for direction and deduplicates events rather than entire transactions',()=>{
  const rows=normalizeTrades([item,item,{...item,id:'event-2',attributes:{...item.attributes,kind:'buy',from_token_address:BUTTERFLY.address,to_token_address:TOKENS[6].address}}],BUTTERFLY.address)
  expect(rows).toHaveLength(2);expect(rows.map(t=>t.side)).toEqual(['buy','sell']);expect(rows[0].toAmount).toBe('12345.123456789')
})
it('does not render malformed hashes, unrelated assets or invalid amounts',()=>{
  for(const extra of [{tx_hash:'javascript:alert(1)'},{from_token_amount:'Infinity'},{block_timestamp:'invalid'},{to_token_address:TOKENS[1].address}])expect(normalizeTrades([{...item,attributes:{...item.attributes,...extra}}],BUTTERFLY.address)).toEqual([])
})
it('preserves zero hourly counts and keeps missing data unknown',()=>{
  const base={chainId:'bsc',dexId:'pancakeswap',pairAddress:pair,baseToken:{address:BUTTERFLY.address},quoteToken:{address:TOKENS[1].address},priceUsd:'0.1',liquidity:{usd:100},txns:{h1:{buys:0,sells:3}},volume:{h1:0}}
  expect(normalizeMarkets([base],[BUTTERFLY.address])[BUTTERFLY.address.toLowerCase()]).toMatchObject({buys1h:0,sells1h:3,volume1h:0})
  expect(normalizeMarkets([{...base,txns:null,volume:null}],[BUTTERFLY.address])[BUTTERFLY.address.toLowerCase()]).toMatchObject({buys1h:null,sells1h:null,volume1h:null})
})
it('bounds requests to BSC pool trades and returns honest errors',async()=>{
  const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:[item]})});vi.stubGlobal('fetch',fetch)
  const res={setHeader:vi.fn(),status:vi.fn(),json:vi.fn()};res.status.mockReturnValue(res)
  await handler({method:'GET',query:{pool:pair,token:BUTTERFLY.address}},res)
  expect(fetch.mock.calls[0][0]).toBe(`https://api.geckoterminal.com/api/v2/networks/bsc/pools/${pair}/trades`)
  expect(res.json.mock.calls[0][0].trades).toHaveLength(1)
  await handler({method:'GET',query:{pool:'https://localhost',token:BUTTERFLY.address}},res);expect(res.status).toHaveBeenCalledWith(400);expect(fetch).toHaveBeenCalledTimes(1)
  fetch.mockResolvedValue({ok:false});await handler({method:'GET',query:{pool:pair,token:BUTTERFLY.address}},res);expect(res.status).toHaveBeenCalledWith(503)
})
