import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { projectConfig } from './config/project'

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline UI test')))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('simplified bilingual brand page', () => {
  it('removes presale UI and entry points in both languages', async () => {
    const { container } = render(<App />)
    await waitFor(() => expect(container.querySelector('#hero-title')).not.toBeNull())
    const check = () => {
      expect(container.querySelector('#presale')).toBeNull()
      expect(projectConfig.presale.websiteOpen).toBe(false)
      expect(container.querySelector('#proof')).toBeNull()
      expect(container.querySelector('.mobile-presale-dock')).toBeNull()
      expect(container.textContent).not.toMatch(/私募|PRIVATE SALE|0\.05 BNB|PUBLIC PROOF|KEEP THE SIGNAL/)
      expect(container.querySelector('.presale-share')).toBeNull()
      expect(container.querySelector('#treasury')).not.toBeNull()
      for (const link of container.querySelectorAll('a[href^="#"]')) {
        expect(document.getElementById(link.getAttribute('href')!.slice(1))).not.toBeNull()
      }
    }
    check()
    fireEvent.click(screen.getByRole('button', { name: '切换到英文' }))
    check()
    expect(document.documentElement.lang).toBe('en')
  })

  it.each(['presale', 'presale-admin'])('retires the legacy %s route', async (view) => {
    window.history.replaceState(null, '', `/?view=${view}#presale`)
    const { container } = render(<App />)
    await waitFor(() => expect(container.querySelector('#hero-title')).not.toBeNull())
    expect(window.location.search).toBe('')
    expect(window.location.hash).toBe('')
    expect(container.textContent).not.toMatch(/私募|PRIVATE SALE/)
  })

  it('connects the homepage wallet without payment and invalidates a changed account', async () => {
    const address = '0xA7E4B6cD8083efd6dE9173021dB6fb42b4822914'
    const listeners = new Map<string, () => void>()
    const request = vi.fn(async ({ method }: { method: string }) => method === 'eth_chainId' ? '0x38' : [address])
    vi.stubGlobal('ethereum', { request, on: (name: string, fn: () => void) => listeners.set(name, fn), removeListener: vi.fn() })
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '连接钱包' }))
    fireEvent.click(await screen.findByRole('button', { name: /Browser Wallet/ }))
    await screen.findByRole('button', { name: '0xA7E4…2914' })
    expect(request.mock.calls.map(([call]) => call.method)).toEqual(['eth_requestAccounts', 'eth_chainId', 'eth_accounts'])
    act(() => listeners.get('accountsChanged')?.())
    expect(screen.getByRole('button', { name: '连接钱包' })).toBeInTheDocument()
  })

  it('preserves the butterfly and brand story', async () => {
    const { container } = render(<App />)
    await waitFor(() => expect(container.querySelector('.butterfly-stage img')).not.toBeNull())
    expect(container.querySelector('.butterfly-stage img')).toHaveAttribute('src', '/flap-stock-avatar.png')
    expect(screen.getByRole('region', { name: '蝴蝶股票四字内核' })).toBeInTheDocument()
  })
  it('opens the swap from the preview query with an adjacent market link', async () => {
    window.history.replaceState(null, '', '/?view=swap')
    render(<App />)
    expect(await screen.findByRole('region', { name: '代币兑换' }, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '美股动态' })).toHaveAttribute('href', '/?view=markets')
    expect(screen.getByRole('textbox', { name: '你支付' })).toHaveValue('')
    expect(screen.getByRole('status', { name: '预计收到数量' })).toHaveTextContent('0.0')
    window.history.replaceState(null, '', '/')
  })
})
