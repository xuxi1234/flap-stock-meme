import {afterEach,it,expect,vi} from 'vitest'
import handler from '../../api/swap-chart'
const token='0x4b112e1ed0c0cb332d2b39e5dae3bba882f67777'
const pool='0x0000000000000000000000000000000000001234'
function response(){return {setHeader:vi.fn(),status:vi.fn().mockReturnThis(),json:vi.fn()}}
afterEach(()=>vi.unstubAllGlobals())
it('bounds requests and selects the token side of the pool',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({data:[{attributes:{address:pool,reserve_in_usd:'100'},relationships:{base_token:{data:{id:'bsc_other'}},quote_token:{data:{id:`bsc_${token}`}}}}]})}).mockResolvedValueOnce({ok:true,json:async()=>({data:{attributes:{ohlcv_list:[[100,1,2,1,2,3]]}}})})
 vi.stubGlobal('fetch',fetcher);const res=response();await handler({method:'GET',query:{token,period:'1h'}},res)
 expect(res.status).toHaveBeenCalledWith(200);expect(fetcher).toHaveBeenCalledTimes(2)
 expect(fetcher.mock.calls[1][0]).toContain(`/${pool}/ohlcv/hour?aggregate=1&limit=120&currency=usd&token=quote`)
 expect(res.json).toHaveBeenCalledWith(expect.objectContaining({token,pool,candles:[{time:100,open:1,high:2,low:1,close:2,volume:3}]}))
})
it('rejects arbitrary URLs, repeated query fields and unknown periods before fetching',async()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher)
 for(const query of [{token:'https://localhost/secret'}, {token:[token,token]}, {token,period:'100000'}]){const res=response();await handler({method:'GET',query},res);expect(res.status).toHaveBeenCalledWith(400)}
 expect(fetcher).not.toHaveBeenCalled()
})
it('does not invent candles when provider has no indexed matching pool',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({data:[]})}));const res=response();await handler({method:'GET',query:{token}},res);expect(res.status).toHaveBeenCalledWith(503);expect(res.setHeader).toHaveBeenCalledWith('Cache-Control','no-store')
})
