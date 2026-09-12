import { formatUnits, isAddress, parseUnits, zeroAddress } from 'viem'

export function units(value: string, decimals: number) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) throw Error('代币精度须为 0–36。')
  if (!/^\d+(\.\d+)?$/.test(value.trim())) throw Error('请输入大于 0 的代币数量。')
  if ((value.split('.')[1]?.length ?? 0) > decimals) throw Error(`最多支持 ${decimals} 位小数，不会自动四舍五入。`)
  const result = parseUnits(value, decimals)
  if (result <= 0n || result > 2n ** 256n - 1n) throw Error('代币数量超出范围。')
  return result
}
export function splitPresale(value: string, decimals: number) {
  const total = units(value, decimals)
  const small = total / 964n
  if (!small) throw Error('总量不足以按代币最小单位分配 964 份。')
  return { small, large: small * 4n, allocated: small * 964n, remainder: total % 964n }
}
export function countValue(value: string, maximum = 200) {
  if (!/^\d+$/.test(value)) throw Error('地址数量须为整数。')
  const count = Number(value)
  if (count < 1 || count > maximum) throw Error(`地址数量须为 1–${maximum}。`)
  return count
}
export function parseRecipients(text: string) {
  const addresses: string[] = []
  const seen = new Set<string>()
  const duplicates: string[] = []
  const errors: number[] = []
  text.replace(/^\uFEFF/, '').split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return
    if (index === 0 && !line.includes('0x') && /地址|address|recipient/i.test(line)) return
    const parts = line.split(/[,;\t\s]+/).map(x => x.replace(/^"|"$/g, ''))
    const matches = parts.filter(x => /^0x[0-9a-fA-F]{40}$/.test(x))
    if (matches.length !== 1 || !isAddress(matches[0]) || matches[0].toLowerCase() === zeroAddress) { errors.push(index + 1); return }
    const address = matches[0].toLowerCase()
    if (seen.has(address)) duplicates.push(address)
    else { seen.add(address); addresses.push(address) }
  })
  return { addresses, duplicates, errors }
}
export function randomRecipients(count: number): string[] {
  const result = new Set<string>()
  while (result.size < count) {
    const bytes = crypto.getRandomValues(new Uint8Array(20))
    const address = '0x' + Array.from(bytes, x => x.toString(16).padStart(2, '0')).join('')
    if (address !== zeroAddress) result.add(address)
  }
  return [...result]
}
export const amountText = (value: bigint, decimals: number) => formatUnits(value, decimals)
export function csvText(rows: (string | number)[][]) {
  return '\uFEFF' + rows.map(row => row.map(value => '"' + String(value).replace(/"/g, '""') + '"').join(',')).join('\r\n')
}
