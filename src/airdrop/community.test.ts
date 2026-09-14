import {describe,it,expect} from 'vitest'
import {validateRecipients,TOKEN} from './community'
const rows=()=>Array.from({length:200},(_,i)=>'0x'+(i+10000).toString(16).padStart(40,'0'))
describe('fixed community batch',()=>{
 it('accepts exactly 200 addresses at one token each',()=>{const r=validateRecipients(rows().join('\n'));expect(r).toHaveLength(200);expect(r.every(x=>x.amount==='1')).toBe(true)})
 it('blocks duplicates instead of silently changing the total',()=>{const r=rows();r[1]=r[0];expect(()=>validateRecipients(r.join('\n'))).toThrow('重复')})
 it('blocks sender and token addresses',()=>{expect(()=>validateRecipients(rows().join('\n'),rows()[0])).toThrow();const r=rows();r[1]=TOKEN;expect(()=>validateRecipients(r.join('\n'))).toThrow()})
 it('rejects incomplete batches and malformed rows',()=>{expect(()=>validateRecipients(rows().slice(1).join('\n'))).toThrow('200');const r=rows();r[0]='invalid';expect(()=>validateRecipients(r.join('\n'))).toThrow()})
})
