import { describe, expect, it } from 'vitest'
import { countValue, parseRecipients, randomRecipients, splitPresale, units } from './math'

describe('airdrop allocation rules', () => {
  it('allocates 151 four-share recipients and 360 one-share recipients', () => {
    const s = splitPresale('964000000', 18)
    expect(s.small).toBe(1000000n * 10n ** 18n)
    expect(s.large).toBe(4000000n * 10n ** 18n)
    expect(s.small * 360n + s.large * 151n).toBe(s.allocated)
    expect(s.remainder).toBe(0n)
  })
  it('keeps integer dust without rounding up or violating 4:1', () => {
    const s = splitPresale('1000', 0)
    expect(s.small).toBe(1n); expect(s.large).toBe(4n); expect(s.remainder).toBe(36n)
  })
  it('rejects excess precision, zero, negatives, exponent syntax and overflow', () => {
    for (const v of ['1.0001', '0', '-7', '1e9', '1,000', '9'.repeat(90)]) expect(() => units(v, 3)).toThrow()
    expect(() => splitPresale('963', 0)).toThrow()
  })
  it('recognizes address CSV including original no-header timestamp rows', () => {
    const a = '0x44a78716b49fd8694ef46132a2b4ebcb016a04d3'
    expect(parseRecipients(`2026/9/9 4:13,${a},0.2`).addresses).toEqual([a])
    expect(parseRecipients(`地址,数量\n${a},7`).addresses).toEqual([a])
  })
  it('reports duplicate, zero, ambiguous, invalid and non-header junk rows', () => {
    const a = '0x44a78716b49fd8694ef46132a2b4ebcb016a04d3'
    const r = parseRecipients(`${a}\n${a}\n0x0000000000000000000000000000000000000000\n${a},${a}\nnot-an-address`)
    expect(r.duplicates.length).toBe(1); expect(r.errors).toEqual([3,4,5]); expect(r.addresses).toEqual([a])
  })
  it('bounds random addresses and generates unique nonzero recipients', () => {
    for (const v of ['0','201','1.5','-2','1e2']) expect(() => countValue(v)).toThrow()
    const addresses = randomRecipients(200)
    expect(new Set(addresses).size).toBe(200)
    expect(parseRecipients(addresses.join('\n')).errors).toEqual([])
  })
})
