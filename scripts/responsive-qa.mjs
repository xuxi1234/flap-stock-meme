import assert from 'node:assert/strict'

const targetUrl = process.env.RESPONSIVE_QA_URL
const viewports = [
  { width: 320, height: 900 },
  { width: 375, height: 900 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1100 },
]

if (!targetUrl) {
  throw new Error('Set RESPONSIVE_QA_URL to a deployed or locally served FLAP STOCK URL before running responsive QA.')
}

let chromium
try {
  ({ chromium } = await import('playwright'))
} catch {
  throw new Error('Responsive QA requires Playwright. Install it with `npm install -D playwright` and `npx playwright install chromium`, then rerun this command.')
}

let browser
try {
  browser = await chromium.launch({ headless: true })
} catch {
  throw new Error('Responsive QA requires a Playwright browser binary. Run `npx playwright install chromium`, then rerun this command.')
}

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport })
    await page.goto(targetUrl, { waitUntil: 'networkidle' })

    const result = await page.evaluate(() => {
      const visible = (element) => {
        const style = window.getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return style.display !== 'none'
          && style.visibility !== 'hidden'
          && Number.parseFloat(style.opacity) > 0
          && rect.width > 0
          && rect.height > 0
          && rect.left >= 0
          && rect.right <= window.innerWidth
      }
      const sections = [...document.querySelectorAll('main > section')]
      const warning = document.querySelector('#presale [role="note"]')
      const headerControls = [...document.querySelectorAll('.brand-lockup, .language-toggle, .site-header nav a, .header-community .community-link')]
      const actionControls = [...document.querySelectorAll('.hero-actions .button, #presale > .button, .footer-community .community-link')]
      const visibleControls = [...headerControls, ...actionControls].filter(visible)
      const rectanglesOverlap = (first, second) => first.left < second.right
        && first.right > second.left
        && first.top < second.bottom
        && first.bottom > second.top
      const controlsDoNotOverlap = visibleControls.every((control, index) => {
        const first = control.getBoundingClientRect()
        return visibleControls.slice(index + 1).every((otherControl) => {
          const second = otherControl.getBoundingClientRect()
          return !rectanglesOverlap(first, second)
        })
      })
      const mobile = window.innerWidth <= 760
      const hasUsableMobileTargets = !mobile || [...headerControls, ...actionControls].every((control) => {
        const rect = control.getBoundingClientRect()
        return visible(control) && rect.width >= 44 && rect.height >= 44
      })

      return {
        sectionCount: sections.length,
        sectionsVisible: sections.every(visible),
        warningVisible: Boolean(warning && visible(warning)),
        noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
        controlsVisible: [...headerControls, ...actionControls].every(visible),
        controlsDoNotOverlap,
        hasUsableMobileTargets,
      }
    })

    assert.equal(result.sectionCount, 9, `${viewport.width}px: all core sections must render`)
    assert.equal(result.sectionsVisible, true, `${viewport.width}px: all core sections must remain visible`)
    assert.equal(result.warningVisible, true, `${viewport.width}px: presale warning must remain visible`)
    assert.equal(result.noHorizontalOverflow, true, `${viewport.width}px: page must not overflow horizontally`)
    assert.equal(result.controlsVisible, true, `${viewport.width}px: controls must remain visible`)
    assert.equal(result.controlsDoNotOverlap, true, `${viewport.width}px: visible controls must not overlap`)
    assert.equal(result.hasUsableMobileTargets, true, `${viewport.width}px: mobile controls must be at least 44px`)
    await page.close()
    console.log(`Responsive QA passed at ${viewport.width}px`)
  }
} finally {
  await browser.close()
}
