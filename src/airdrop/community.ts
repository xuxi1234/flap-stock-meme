import { isAddress, zeroAddress } from 'viem'
export const TOKEN='0x4b112e1ed0c0cb332d2b39e5dae3bba882f67777'
export const DISTRIBUTOR='0x369890cb7a233be14d33fd4265b26afadce00bc0'
export function validateRecipients(text:string,wallet=''){
 const rows=text.replace(/^\uFEFF/,'').split(/[\s,;]+/).filter(Boolean)
 if(rows.length!==200)throw Error(`需要正好 200 个地址，当前为 ${rows.length} 个。CSV 请只保留地址列，不要表头。`)
 const blocked=[TOKEN,DISTRIBUTOR,zeroAddress,'0x000000000000000000000000000000000000dead',wallet].map(x=>x.toLowerCase())
 if(rows.some(x=>!isAddress(x)||blocked.includes(x.toLowerCase())))throw Error('名单含无效地址、禁止接收地址或发送钱包自身。')
 if(new Set(rows.map(x=>x.toLowerCase())).size!==200)throw Error('名单有重复地址，请去重后补足 200 个。')
 return rows.map(address=>({address:address.toLowerCase(),amount:'1'}))
}
