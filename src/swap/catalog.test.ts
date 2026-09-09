import { describe, expect, it } from 'vitest'
import { isAddress } from 'viem'
import { STOCK_TOKENS, MAG7_SYMBOLS, TOKENS, matchesToken, selectedStockToken, tokenKey } from './config'

describe('stock catalog identity and discovery', () => {
  it.each(['苹果', 'Apple', 'AAPL', 'AAPLB', '  aaplb  '])('finds Apple by %s', query => {
    expect(STOCK_TOKENS.filter(t => matchesToken(t, query)).map(t => t.symbol)).toEqual(['AAPLB'])
  })
  it('keeps native BNB distinct from wrapped BNB and rejects duplicate contracts', () => {
    expect(new Set(TOKENS.map(tokenKey)).size).toBe(TOKENS.length)
    for (const token of STOCK_TOKENS) {
      expect(isAddress(token.address)).toBe(true)
      expect(token.logoURI).toMatch(/^https:\/\/bin\.bnbstatic\.com\//)
      expect(token.source).toMatch(/^https:\/\/www\.binance\.com\//)
      expect(token.decimals).toBe(18)
      expect(token.custom).not.toBe(true)
    }
  })
  it('includes all seven stocks exactly once with searchable names and deep links', () => {
    for (const symbol of MAG7_SYMBOLS) {
      const matches = STOCK_TOKENS.filter(t => t.stockSymbol === symbol)
      expect(matches).toHaveLength(1)
      expect(matchesToken(matches[0], symbol)).toBe(true)
      expect(selectedStockToken('?outputCurrency=' + matches[0].address)).toBe(matches[0])
    }
  })
  it('accepts only catalog contracts in market deep links', () => {
    expect(selectedStockToken('?outputCurrency=' + STOCK_TOKENS[0].address.toUpperCase())?.symbol).toBe('AAPLB')
    expect(selectedStockToken('?outputCurrency=0x0000000000000000000000000000000000000001')).toBeUndefined()
    expect(selectedStockToken('?outputCurrency=AAPLB')).toBeUndefined()
  })
})
