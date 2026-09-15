import {expect,it} from 'vitest'
import {normalizeCandles} from './chartData'
it('orders historical candles without inventing missing intervals',()=>{const c=normalizeCandles([[200,2,3,1,2,8],[100,1,3,1,2,0]]);expect(c.map(c=>c.time)).toEqual([100,200]);expect(c[0].volume).toBe(0)})
it('rejects impossible OHLC, duplicate timestamps and nonnumeric data',()=>{for(const rows of [[[100,2,1,1,2,0]],[[100,1,2,0,1,1]],[[100,1,2,1,1,-1]],[[100,'1',2,1,1,0]],[[100,1,2,1,1,0],[100,1,2,1,1,0]]])expect(()=>normalizeCandles(rows)).toThrow()})
