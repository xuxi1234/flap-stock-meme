import { describe, expect, it } from 'vitest'
import { decodeAbiParameters, decodeFunctionData } from 'viem'
import { encodeSchema, fieldValue, launchParams, launchData, launchAbi, REVENUE, ZERO, scaled, type LaunchInput } from './protocol'
const field = { name: 'amount', fieldType: 'uint256', description: '', decimals: 18 }
const input: LaunchInput = {name:'Vault test',symbol:'VT',meta:'bafybeidt6jz5ghmrdfjwgvj3d5pcncd5pkpjaik5ke3seu7bkad2o6xvlq',quoteToken:ZERO,buyPct:'3',sellPct:'3',taxDays:'36500',protectionDays:'30',mktPct:'100',burnPct:'0',dividendPct:'0',lpPct:'0',minimumHold:'0',dividendToken:ZERO}
describe('actual vault encoding',()=>{
  it('scales exactly, never rounding an excessive decimal',()=>{expect(fieldValue(field,'0.01')).toBe(10n**16n);expect(()=>scaled('0.0001',2)).toThrow();expect(()=>scaled('1e18',18)).toThrow();expect(()=>fieldValue({...field,fieldType:'uint8',decimals:0},'256')).toThrow()})
  it('preserves bool false and rejects malformed addresses',()=>{expect(fieldValue({...field,fieldType:'bool'},'false')).toBe(false);expect(()=>fieldValue({...field,fieldType:'address'},'0x123')).toThrow()})
  it('encodes ordered tuples including array shape',()=>{
    const s={description:'',fields:[field],isArray:true};const encoded=encodeSchema(s,[{amount:'1'},{amount:'2'}]);expect(decodeAbiParameters([{type:'tuple[]',components:[{name:'amount',type:'uint256'}]}],encoded)[0]).toEqual([{amount:10n**18n},{amount:2n*10n**18n}]);expect(encodeSchema({...s,fields:[],isArray:false},[{}])).toBe('0x')
  })
  it('puts revenue in the actual transaction and keeps all tax distributions',()=>{
    const p=launchParams(input,REVENUE,'0x',('0x'+'1'.repeat(64)) as `0x${string}`);const args=decodeFunctionData({abi:launchAbi,data:launchData(p)}).args;expect(args?.[0]).toMatchObject({commissionReceiver:REVENUE,vaultFactory:REVENUE,quoteAmt:0n,mktBps:10000,tokenVersion:6});expect(()=>launchParams({...input,mktPct:'101'},REVENUE,'0x',p.salt)).toThrow();expect(()=>launchParams({...input,buyPct:'0',sellPct:'0'},REVENUE,'0x',p.salt)).toThrow()
  })
})
