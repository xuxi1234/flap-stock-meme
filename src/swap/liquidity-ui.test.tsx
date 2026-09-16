import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { PublicClient } from 'viem'
import { LiquidityPage } from './LiquidityPage'
import { readPool, type PoolPosition } from './liquidity'
vi.mock('./liquidity',async original=>({...await original<typeof import('./liquidity')>(),readPool:vi.fn()}))
afterEach(()=>{cleanup();vi.clearAllMocks();localStorage.clear()})
const unit=10n**18n
const pool:PoolPosition={pair:'0x1111111111111111111111111111111111111111',reserveA:100n*unit,reserveB:20000n*unit,supply:1000n*unit,owned:null,block:1n,fetchedAt:Date.now()}
it('preserves both input limits across a pool refresh instead of silently increasing an approval',async()=>{
  vi.mocked(readPool).mockResolvedValueOnce(pool).mockResolvedValue({...pool,reserveB:30000n*unit,block:2n})
  render(<LiquidityPage client={{} as PublicClient} wallet={null} account={null} onConnect={()=>{}} onBusy={()=>{}}/>)
  await waitFor(()=>expect(screen.queryByText('正在读取链上池子…')).not.toBeInTheDocument())
  fireEvent.change(screen.getByLabelText('流动性 A 数量'),{target:{value:'2'}})
  expect(screen.getByLabelText('流动性 B 数量')).toHaveValue('400')
  fireEvent.click(screen.getByRole('button',{name:'刷新 ↻'}))
  await waitFor(()=>expect(screen.getByText(/区块 #2/)).toBeInTheDocument())
  expect(screen.getByLabelText('流动性 A 数量')).toHaveValue('2')
  expect(screen.getByLabelText('流动性 B 数量')).toHaveValue('400')
  fireEvent.change(screen.getByLabelText('流动性 A 数量'),{target:{value:'3'}})
  expect(screen.getByLabelText('流动性 B 数量')).toHaveValue('900')
})
