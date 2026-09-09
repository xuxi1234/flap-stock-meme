import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { getAddress } from 'viem'
const stocks = JSON.parse(readFileSync(new URL('../src/swap/stock-tokens.json', import.meta.url), 'utf8'))
const list = { name: 'Butterfly BSC Stocks', timestamp: '2026-09-09T12:00:00Z', version: { major: 1, minor: 0, patch: 0 }, keywords: ['bsc', 'stocks', 'bstocks'], tokens: stocks.map(t => ({ chainId: 56, address: getAddress(t.address), decimals: t.decimals, name: t.name.slice(0, 60), symbol: t.symbol, logoURI: t.logoURI, tags: [t.category], extensions: { stockSymbol: t.stockSymbol } })), tags: { stock: { name: 'Stock linked token', description: 'Tokenized stock exposure, not direct equity ownership.' }, etf: { name: 'ETF linked token', description: 'Tokenized ETF exposure, includes leveraged inverse ETFs.' } } }
mkdirSync('dist', { recursive: true })
writeFileSync('dist/butterfly-stock-list.json', JSON.stringify(list, null, 2) + '\n')
