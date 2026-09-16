export type Candle = {time:number;open:number;high:number;low:number;close:number;volume:number}
export type ChartSnapshot = {candles:Candle[];pool:string;fetchedAt:number;token:string}
export const CHART_PERIODS = {'15m':{timeframe:'minute',aggregate:15},'1h':{timeframe:'hour',aggregate:1},'4h':{timeframe:'hour',aggregate:4},'1d':{timeframe:'day',aggregate:1}} as const
export function normalizeCandles(rows:unknown): Candle[] {
  if (!Array.isArray(rows) || rows.length > 1000) throw Error('Invalid candles')
  const candles = new Map<number,Candle>()
  for (const row of rows) {
    if (!Array.isArray(row) || row.length !== 6 || row.some(x=>typeof x !== 'number' || !Number.isFinite(x))) throw Error('Invalid candle')
    const [time,open,high,low,close,volume] = row
    if (!Number.isSafeInteger(time) || time <= 0 || low <= 0 || volume < 0 || high < Math.max(open,close) || low > Math.min(open,close)) throw Error('Invalid OHLC')
    if(candles.has(time)) throw Error('Duplicate candle')
    candles.set(time,{time,open,high,low,close,volume})
  }
  return [...candles.values()].sort((a,b)=>a.time-b.time)
}
