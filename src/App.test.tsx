import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'

afterEach(cleanup)

describe('simplified bilingual brand page', () => {
  it('removes the three sections and their entry points in both languages', () => {
    const { container } = render(<App />)
    const check = () => {
      expect(container.querySelector('#presale')).not.toBeNull()
      expect(container.querySelector('#proof')).toBeNull()
      expect(container.querySelector('.mobile-presale-dock')).not.toBeNull()
      expect(container.textContent).not.toMatch(/PUBLIC PROOF|KEEP THE SIGNAL|0\.055 BNB|0\.2 BNB/)
      expect(container.querySelector('.presale-share input')).toHaveValue('https://www.hudiegupiao.com/?utm_source=community&utm_medium=share&utm_campaign=presale#presale')
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

  it('preserves the butterfly and brand story', () => {
    const { container } = render(<App />)
    expect(container.querySelector('.butterfly-stage img')).toHaveAttribute('src', '/flap-stock-avatar.png')
    expect(screen.getByRole('region', { name: '蝴蝶股票四字内核' })).toBeInTheDocument()
  })
})
