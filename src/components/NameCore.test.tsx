import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { siteContent } from '../content/siteContent'
import { NameCore } from './NameCore'

afterEach(cleanup)

describe('NameCore', () => {
  it('renders glyphs supplied by localized content instead of positional constants', () => {
    const customGlyphs = ['甲', '乙', '丙', '丁']
    const copy = {
      ...siteContent.zh.nameCore,
      cards: siteContent.zh.nameCore.cards.map((card, index) => ({ ...card, glyph: customGlyphs[index] })),
    }
    const { container } = render(<NameCore copy={copy} />)

    expect([...container.querySelectorAll('.name-core-glyph')].map((glyph) => glyph.textContent)).toEqual(customGlyphs)
  })
})
