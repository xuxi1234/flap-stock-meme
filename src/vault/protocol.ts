import { encodeAbiParameters, encodeFunctionData, getAddress, getContractAddress, isAddress, keccak256, parseAbi, parseUnits, type AbiParameter, type Address, type Hex } from 'viem'
import project from '../../public/vault/project-config.json'

export const OWNER = getAddress(project.adminAddress)
export const REVENUE = getAddress(project.platformRevenueRecipient)
export const BUDGET = BigInt(project.executionBudgetWei)
export const ZERO = '0x0000000000000000000000000000000000000000' as Address
export const PORTAL = '0xe2cE6ab80874Fa9Fa2aAE65D277Dd6B8e65C9De0' as Address
export const VAULT_PORTAL = '0x90497450f2a706f1951b5bdda52B4E5d16f34C06' as Address
export const TAX_IMPL = '0x024f18294970B5c76c0691b87f138A0317156422' as Address
export const FIELD = '(string name,string fieldType,string description,uint8 decimals)'
export const factoryAbi = parseAbi([
  `function vaultDataSchema() view returns ((string description,${FIELD}[] fields,bool isArray))`,
  'function tokenCreationPolicies() view returns ((string target,string operator,string value,string description)[])',
  'function owner() view returns (address)',
])
export const launchAbi = parseAbi([
  'function newTokenV6WithVault((string name,string symbol,string meta,uint8 dexThresh,bytes32 salt,uint8 migratorType,address quoteToken,uint256 quoteAmt,bytes permitData,bytes32 extensionID,bytes extensionData,uint8 dexId,uint8 lpFeeProfile,uint16 buyTaxRate,uint16 sellTaxRate,uint64 taxDuration,uint64 antiFarmerDuration,uint16 mktBps,uint16 deflationBps,uint16 dividendBps,uint16 lpBps,uint256 minimumShareBalance,address dividendToken,address commissionReceiver,uint8 tokenVersion,address vaultFactory,bytes vaultData) params) payable returns (address token)',
  'event FlapTaxVaultTokenCreated(address indexed token,address indexed vault,address indexed vaultFactory)',
  'function getVault(address taxToken) view returns ((address vault,address vaultFactory,string description,bool isOfficial,uint8 riskLevel))',
  'error InvalidVaultFactory()', 'error VaultCreationFailed()', 'error InvalidFeeConfig()', 'error InvalidTaxRate()',
  'error InvalidMktBps()', 'error InvalidSalt()', 'error SaltAlreadyUsed()', 'error UnsupportedQuoteToken(address quote)',
  'error FeatureDisabled()', 'error BlacklistedNameOrSymbol(string value)',
])
export const uiAbi = parseAbi([
  `function vaultUISchema() view returns ((string vaultType,string description,(string name,string description,${FIELD}[] inputs,${FIELD}[] outputs,(string tokenType,string amountFieldName)[] approvals,bool isInputArray,bool isOutputArray,bool isWriteMethod)[] methods))`,
  'function description() view returns (string)', 'function taxToken() view returns (address)', 'function lpToken() view returns (address)',
])
export type Field = { name: string; fieldType: string; description: string; decimals: number }
export type Schema = { description: string; fields: readonly Field[]; isArray: boolean }
export type Method = { name: string; description: string; inputs: readonly Field[]; outputs: readonly Field[]; approvals: readonly { tokenType: string; amountFieldName: string }[]; isInputArray: boolean; isOutputArray: boolean; isWriteMethod: boolean }
export type Row = Record<string, string>

export function fieldType(f: Field) {
  const type = f.fieldType === 'time' ? 'uint256' : f.fieldType
  if (!/^(address|bool|string|bytes([1-9]|[12][0-9]|3[0-2])?|u?int(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?)(\[\])?$/.test(type)) throw Error(`不支持的合约字段类型：${type}`)
  return type
}
export function scaled(value: string, decimals: number) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 77 || !/^-?\d+(\.\d+)?$/.test(value) || (value.split('.')[1]?.length || 0) > decimals) throw Error(`数量格式无效，最多 ${decimals} 位小数`)
  return parseUnits(value, decimals)
}
export function fieldValue(f: Field, raw: string): unknown {
  const type = fieldType(f); const value = raw.trim()
  if (type.endsWith('[]')) {
    const items: unknown = JSON.parse(value)
    if (!Array.isArray(items) || items.length > 100) throw Error('数组最多 100 项')
    return items.map(v => fieldValue({ ...f, fieldType: type.slice(0, -2) }, String(v)))
  }
  if (type === 'address') { if (!isAddress(value, { strict: true })) throw Error(`${f.name} 地址无效`); return getAddress(value) }
  if (type === 'bool') { if (!['true', 'false'].includes(value)) throw Error(`${f.name} 必须为 true 或 false`); return value === 'true' }
  if (type === 'string') { if (raw.length > 4096) throw Error('文字过长'); return raw }
  if (type.startsWith('bytes')) { if (!/^0x([0-9a-fA-F]{2})*$/.test(value) || (type !== 'bytes' && value.length !== 2 + Number(type.slice(5)) * 2)) throw Error(`${f.name} 十六进制长度无效`); return value }
  const n = scaled(value, f.decimals), bits = BigInt(Number(type.replace(/u?int/, '')) || 256), signed = type.startsWith('int')
  if (n < (signed ? -(2n ** (bits - 1n)) : 0n) || n >= 2n ** (signed ? bits - 1n : bits)) throw Error(`${f.name} 超出合约数值范围`)
  return n
}
export function components(fields: readonly Field[]): AbiParameter[] { return fields.map(f => ({ name: f.name, type: fieldType(f) } as AbiParameter)) }
export function encodeSchema(schema: Schema, rows: Row[]): Hex {
  if (schema.fields.length > 100 || rows.length > 100 || rows.length < 1) throw Error('参数数量无效')
  if (!schema.fields.length && !schema.isArray) return '0x'
  const values = rows.map(r => schema.fields.map(f => fieldValue(f, r[f.name] ?? '')))
  return encodeAbiParameters([{ type: schema.isArray ? 'tuple[]' : 'tuple', components: components(schema.fields) }], [schema.isArray ? values : values[0]])
}
export function defaults(fields: readonly Field[]): Row {
  return Object.fromEntries(fields.map(f => [f.name, f.fieldType === 'address' ? (/^(marketingWallet|communityWallet|opsWallet|foundationWallet)$/.test(f.name) ? REVENUE : /^asset[1-9]|^stock/.test(f.name) ? ZERO : '') : f.fieldType === 'bool' ? 'false' : f.fieldType.includes('[') ? '[]' : f.fieldType.startsWith('bytes') ? '0x' : f.fieldType === 'string' ? '' : /intervalSeconds/.test(f.name) ? '60' : /spendBps/.test(f.name) ? '1000' : /amountPerBuyback/.test(f.name) ? '0.01' : /lockDays/.test(f.name) ? '365' : '0']))
}
export type LaunchInput = { name: string; symbol: string; meta: string; quoteToken: Address; buyPct: string; sellPct: string; taxDays: string; protectionDays: string; mktPct: string; burnPct: string; dividendPct: string; lpPct: string; minimumHold: string; dividendToken: Address }
export function launchParams(input: LaunchInput, factory: Address, data: Hex, salt: Hex) {
  if (!input.name.trim() || input.name.length > 64 || !input.symbol.trim() || input.symbol.length > 16) throw Error('请填写名称（1–64 字）与符号（1–16 字）')
  if (!/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,})$/.test(input.meta)) throw Error('请先上传封面取得有效 IPFS CID')
  const buy = scaled(input.buyPct, 2), sell = scaled(input.sellPct, 2)
  if (buy < 0n || sell < 0n || buy > 1000n || sell > 1000n || buy + sell === 0n) throw Error('买卖税须在 0–10%，不能同时为 0')
  const portions = [input.mktPct, input.burnPct, input.dividendPct, input.lpPct].map(s => scaled(s, 2))
  if (portions.some(n => n < 0n) || portions.reduce((a,b) => a+b, 0n) !== 10000n || portions[0] === 0n) throw Error('分配合计须为 100%，金库份额须大于 0')
  const taxDays = scaled(input.taxDays, 0), protection = scaled(input.protectionDays, 0)
  if (taxDays < 365n || taxDays > 36500n || protection < 1n || protection > 365n) throw Error('税收期限为 365–36500 天，保护期为 1–365 天')
  return { name: input.name.trim(), symbol: input.symbol.trim(), meta: input.meta, dexThresh: 1, salt, migratorType: 1,
    quoteToken: getAddress(input.quoteToken), quoteAmt: 0n, permitData: '0x' as Hex, extensionID: ('0x'+'0'.repeat(64)) as Hex, extensionData: '0x' as Hex,
    dexId: 0, lpFeeProfile: 0, buyTaxRate: Number(buy), sellTaxRate: Number(sell), taxDuration: taxDays*86400n, antiFarmerDuration: protection*86400n,
    mktBps: Number(portions[0]), deflationBps: Number(portions[1]), dividendBps: Number(portions[2]), lpBps: Number(portions[3]), minimumShareBalance: scaled(input.minimumHold,18),
    dividendToken: getAddress(input.dividendToken), commissionReceiver: REVENUE, tokenVersion: 6, vaultFactory: getAddress(factory), vaultData: data }
}
export const launchData = (p: ReturnType<typeof launchParams>) => encodeFunctionData({ abi: launchAbi, functionName: 'newTokenV6WithVault', args: [p] })
const cloneBytecode = ('0x3d602d80600a3d3981f3363d3d373d3d3d363d73'+TAX_IMPL.slice(2).toLowerCase()+'5af43d82803e903d91602b57fd5bf3') as Hex
export function predictToken(salt: Hex) { return getContractAddress({ from: PORTAL, salt, bytecode: cloneBytecode, opcode: 'CREATE2' }) }
export async function mineSalt(progress: (n:number)=>void, cancelled:()=>boolean = ()=>false) {
  let salt = ('0x'+Array.from(crypto.getRandomValues(new Uint8Array(32)), b=>b.toString(16).padStart(2,'0')).join('')) as Hex
  for (let i=0; i<2_000_000; i++) { if (cancelled()) throw Error('参数已修改，请重新检查'); const address = predictToken(salt); if (address.toLowerCase().endsWith('7777')) return {salt,address}; salt=keccak256(salt); if(i%1000===0){progress(i);await new Promise(r=>setTimeout(r,0))} }
  throw Error('地址生成超时，请重试')
}
