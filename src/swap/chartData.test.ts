import {expect,it} from 'vitest'
import {normalizeCandles} from './chartData'
it('orders historical candles without inventing missing intervals',()=>{const c=normalizeCandles([[200,2,3,1,2,8],[100,1,3,1,2,0]]);expect(c.map(c=>c.time)).toEqual([100,200]);expect(c[0].volume).toBe(0)})
it('rejects impossible OHLC and nonnumeric data',()=>{for(const rows of [[[100,2,1,1,2,0]],[[100,1,2,0,1,1]],[[100,1,2,1,1,-1]],[[100,'1',2,1,1,0]]])expect(()=>normalizeCandles(rows)).toThrow()})

it('deduplicates overlapping provider candles without adding volume or replacing the first record',()=>{
 const rows=[[200,2,3,1,2,8],[100,1,3,1,2,7],[100,2,4,1,3,7]]
 expect(normalizeCandles(rows)).toEqual([{time:100,open:1,high:3,low:1,close:2,volume:7},{time:200,open:2,high:3,low:1,close:2,volume:8}])
})
