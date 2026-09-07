import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body)) as { id: number; params?: [{ data?: string }] }
    const selector = request.params?.[0]?.data?.slice(0, 10)
    const result = selector === '0x3197cbb6'
      ? '0x000000000000000000000000000000000000000000000000000000006aa1827f'
      : selector === '0x857aa4c1'
        ? '0x0000000000000000000000000000000000000000000000000000000000000012'
        : '0x0000000000000000000000000000000000000000000000000000000000000000'
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }), { headers: { 'content-type': 'application/json' } })
  }))
})

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('FLAP STOCK participation center', () => {
  it('puts participation before the brand story without the removed rules section', () => {
    render(<App />)
    const regions = [...document.querySelectorAll('main > section')].map((node) => node.getAttribute('aria-label'))
    expect(regions).not.toContain('参与规则')
    expect(regions.indexOf('参与中心')).toBeLessThan(regions.indexOf('蝴蝶股票四字内核'))
    expect(screen.queryByRole('heading', { name: '付款之前，这些必须看懂。' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '连接、参与、查询，都在这里。' })).toBeInTheDocument()
  })

  it('removes marked sections and footer text without leaving broken anchors', () => {
    render(<App />)
    expect(document.querySelector('#rules')).toBeNull()
    expect(document.querySelector('.site-footer .disclaimer')).toBeNull()
    expect(screen.queryByRole('heading', { name: '三步参与，状态一路可查。' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '参与前，再确认一遍。' })).not.toBeInTheDocument()
    for (const link of document.querySelectorAll('a[href^="#"]')) {
      expect(document.getElementById(link.getAttribute('href')!.slice(1))).not.toBeNull()
    }
  })

  it('exposes verifiable project information and marks the token contract separately as pending', () => {
    render(<App />)
    const proof = screen.getByRole('region', { name: '项目公开信息' })
    expect(within(proof).getByText('预售合约')).toBeInTheDocument()
    expect(within(proof).getByText('FLAP 代币合约')).toBeInTheDocument()
    expect(within(proof).getByText('0x409c9448172b0f244a6823e91ad669281294622b')).toBeInTheDocument()
    expect(within(proof).getByText(/不要把预售合约误认为代币合约/)).toBeInTheDocument()
    expect(within(proof).getAllByRole('link', { name: 'BscScan 查看' }).length).toBeGreaterThanOrEqual(3)
  })

  it('switches the complete product path to English', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '切换到英文' }))
    expect(screen.queryByRole('region', { name: 'Participation Rules' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Participation Center' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Public Project Information' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Understand this before you pay.' })).not.toBeInTheDocument()
    expect(document.querySelector('.site-footer .disclaimer')).toBeNull()
    expect(document.documentElement.lang).toBe('en')
  })

  it('keeps the animated butterfly and one mobile conversion dock', () => {
    const { container } = render(<App />)
    expect(screen.getByRole('img', { name: '正在煽动翅膀的蝴蝶股票品牌头像' })).toBeInTheDocument()
    expect(container.querySelector('.butterfly-stage img')).toHaveAttribute('src', '/flap-stock-avatar.png')
    expect(container.querySelectorAll('.mobile-presale-dock')).toHaveLength(1)
    expect(container.querySelector('.mobile-presale-dock a')).toHaveAttribute('href', '#presale')
  })
})
