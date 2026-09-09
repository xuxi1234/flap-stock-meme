import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline UI test')))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('simplified bilingual brand page', () => {
  it('removes the three sections and their entry points in both languages', async () => {
    const { container } = render(<App />)
    await waitFor(() => expect(container.querySelector('#presale')).not.toBeNull())
    const check = () => {
      expect(container.querySelector('#presale')).not.toBeNull()
      expect(container.querySelector('#proof')).toBeNull()
      expect(container.querySelector('.mobile-presale-dock')).not.toBeNull()
      expect(container.textContent).not.toMatch(/PUBLIC PROOF|KEEP THE SIGNAL|0\.055 BNB|0\.2 BNB/)
      expect(container.querySelector('.presale-share input')).toHaveValue('')
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

  it('preserves the butterfly and brand story', async () => {
    const { container } = render(<App />)
    await waitFor(() => expect(container.querySelector('.butterfly-stage img')).not.toBeNull())
    expect(container.querySelector('.butterfly-stage img')).toHaveAttribute('src', '/flap-stock-avatar.png')
    expect(screen.getByRole('region', { name: '蝴蝶股票四字内核' })).toBeInTheDocument()
  })
  it('opens the swap from the preview query with an adjacent market link', async () => {
    window.history.replaceState(null, '', '/?view=swap')
    render(<App />)
    expect(await screen.findByRole('region', { name: '代币兑换' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '美股动态' })).toHaveAttribute('href', '/?view=markets')
    expect(screen.getByRole('textbox', { name: '你支付' })).toHaveValue('')
    expect(screen.getByRole('status', { name: '预计收到数量' })).toHaveTextContent('0.0')
    window.history.replaceState(null, '', '/')
  })
})
