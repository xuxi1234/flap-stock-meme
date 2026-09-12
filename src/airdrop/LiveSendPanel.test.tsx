import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { Address, EIP1193Provider, Hex } from 'viem'
import LiveSendPanel from './LiveSendPanel'
import { loadTask, newTask, saveTask, upgradeToSingleTransaction } from './live'
vi.mock('./live', async original => ({ ...await original<typeof import('./live')>(), upgradeToSingleTransaction: vi.fn() }))
it('offers migration for the screenshot state: one confirmed legacy batch and a pending transaction', async () => {
  localStorage.clear()
  const wallet='0x1111111111111111111111111111111111111111' as Address
  const token='0x2222222222222222222222222222222222222222' as Address
  const dist='0x3333333333333333333333333333333333333333' as Address
  const hash=('0x'+'ab'.repeat(32)) as Hex
  const t=newTask(wallet,token,18,Array.from({length:200},(_,i)=>({address:'0x'+(1000+i).toString(16).padStart(40,'0'),amount:'7'})),'random','0.02')
  delete t.toolVersion;t.distributor=dist
  t.records=[{kind:'send',hash,status:'success',gasWei:'200',batch:0}]
  t.intent={kind:'send',to:dist,data:'0x',nonce:2,gas:'200000',gasPrice:'1',hash,createdAt:'test',batch:1};saveTask(t)
  vi.mocked(upgradeToSingleTransaction).mockImplementation(async()=>{
    const updated={...t,toolVersion:2 as const,legacySentRows:25,retiredDistributor:dist,distributor:undefined,intent:undefined,records:t.records.map(r=>({...r,layout:'legacy' as const}))}
    saveTask(updated);return updated
  })
  render(<LiveSendPanel wallet={wallet} provider={{request:vi.fn()} as unknown as EIP1193Provider} plan={null} verified={false}/>)
  const button=await screen.findByRole('button',{name:'核对已发记录，合并剩余地址'})
  expect(button).toBeEnabled()
  expect(screen.queryByRole('button',{name:'检查下一步与网络费'})).not.toBeInTheDocument()
  fireEvent.click(button)
  await waitFor(()=>expect(screen.getByRole('button',{name:'检查下一步与网络费'})).toBeInTheDocument())
  expect(screen.getByText('175 个地址 · 1225 枚')).toBeInTheDocument()
  expect(loadTask(wallet)?.rows).toHaveLength(200)
  expect(loadTask(wallet)?.records).toHaveLength(1)
})
