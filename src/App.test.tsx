import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import css from './styles.css?raw'
import responsiveQa from '../scripts/responsive-qa.mjs?raw'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body)) as { id: number; params?: [{ data?: string }] }
    const selector = request.params?.[0]?.data?.slice(0, 10)
    const result = selector === '0x3197cbb6'
      ? '0x000000000000000000000000000000000000000000000000000000006aa1827f'
      : '0x0000000000000000000000000000000000000000000000000000000000000000'

    return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }), {
      headers: { 'content-type': 'application/json' },
    })
  }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const ruleFontSizeRem = (selector: string) => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const rules = css.matchAll(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 'g'))
  const fontSize = Array.from(rules, (rule) => rule[1].match(/font-size:\s*([\d.]+)rem/)?.[1])
    .find((size) => size !== undefined)

  return Number(fontSize ?? 0)
}

const ruleDeclarations = (selector: string) => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const rule = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))
  return rule?.[1] ?? ''
}

describe('FLAP STOCK narrative page', () => {
  it('defines the acid-neon motion and reduced-motion visual contract', () => {
    expect(css).toContain('--acid: #c8ff00')
    expect(css).toContain('--purple: #5b20ff')
    expect(css).toContain('@keyframes wingPulse')
    expect(css).toContain('@keyframes tickerFlow')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('keeps financial safety copy at the body-text size floor', () => {
    const safetyCopySelectors = [
      '#signal article > small',
      '#presale > p[role="note"]',
      '.site-footer',
    ]

    safetyCopySelectors.forEach((selector) => {
      expect(ruleFontSizeRem(selector), selector).toBeGreaterThanOrEqual(1)
    })

    expect(ruleDeclarations('#signal article > small')).toContain('color: var(--paper)')
    expect(ruleDeclarations('#signal article > strong')).toContain('overflow-wrap: anywhere')
  })

  it('renders every Chinese narrative section and exposes the live presale entry', () => {
    const { container } = render(<App />)

    expect(document.documentElement.lang).toBe('zh-CN')
    expect(screen.getByRole('heading', { level: 1, name: /蝴蝶股票/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'FLAP STOCK 首页' })).toHaveAttribute('href', '#top')
    expect(screen.getByRole('navigation', { name: '主导航' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '切换到英文' })).toBeInTheDocument()
    expect(screen.getByLabelText('正在煽动翅膀的蝴蝶股票品牌头像')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '正在煽动翅膀的蝴蝶股票品牌头像' })).toBeInTheDocument()
    const chineseTicker = screen.getByRole('region', { name: 'FLAP STOCK 项目详情' })
    const chineseTickerLabels = ['代币', '网络', '入场', '席位', '信号']
    expect(chineseTicker).toBeInTheDocument()
    chineseTickerLabels.forEach((label) => {
      expect(within(chineseTicker).getByText(label)).toBeInTheDocument()
    })
    expect(screen.getByRole('region', { name: /蝴蝶效应/ })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /Meme 信号终端/ })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /蝴蝶股票四字内核/ })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /预售控制台/ })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /参与方式/ })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /路线图/ })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /社区宣言/ })).toBeInTheDocument()
    expect(screen.getAllByText(/非金融数据/).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: '立即振翅 · 0.05 BNB' })).toHaveAttribute('href', '#presale')
    expect(screen.queryByRole('button', { name: /预售尚未开放/ })).not.toBeInTheDocument()
    expect(screen.getByText('预售正在振翅')).toBeInTheDocument()
    expect(screen.getByText('固定 0.05 BNB')).toBeInTheDocument()
    expect(screen.getByText('只能振翅一次')).toBeInTheDocument()
    expect(container.querySelector('.ticker')).toHaveTextContent('$FLAP · 振翅向上 · $FLAP')
    expect(container.querySelector('.hero-poster-note')).toHaveTextContent('别等风来把风扇起来')
    expect(document.querySelector('.mobile-presale-dock a')).toHaveAttribute('aria-label', '使用 0.05 BNB 立即参与蝴蝶股票预售')
    expect(document.querySelector('.mobile-presale-dock a')).toHaveAttribute('href', '#presale')

    const heroSignal = screen.getByRole('complementary', { name: '今日 Meme 信号' })
    expect(within(heroSignal).getByText('万蝶共振')).toBeInTheDocument()
    expect(within(heroSignal).getByText(/非金融数据/)).toBeInTheDocument()

    const header = screen.getByRole('banner')
    const footer = screen.getByRole('contentinfo')
    ;[header, footer].forEach((landmark) => {
      expect(within(landmark).getByRole('button', { name: 'X：即将开放' })).toBeDisabled()
      expect(within(landmark).getByRole('button', { name: 'Telegram：即将开放' })).toBeDisabled()
      expect(within(landmark).getAllByText(/即将开放/)).toHaveLength(2)
    })
  })

  it('switches narrative content, presale rules, and disclaimers to English', () => {
    const { container } = render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '切换到英文' }))

    expect(screen.getByRole('heading', { name: /FLAP STOCK/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'FLAP STOCK home' })).toHaveAttribute('href', '#top')
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Switch to Chinese' })).toBeInTheDocument()
    expect(screen.getByLabelText('Animated FLAP STOCK butterfly avatar')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Animated FLAP STOCK butterfly avatar' })).toBeInTheDocument()
    const englishTicker = screen.getByRole('region', { name: 'FLAP STOCK project details' })
    const englishTickerLabels = ['TOKEN', 'CHAIN', 'ENTRY', 'SEATS', 'SIGNAL']
    expect(englishTicker).toBeInTheDocument()
    englishTickerLabels.forEach((label) => {
      expect(within(englishTicker).getByText(label)).toBeInTheDocument()
    })
    expect(screen.getByRole('region', { name: 'The Butterfly Effect' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Meme Signal Terminal' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'FLAP STOCK Character Core' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Presale Console' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'How to Join' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Roadmap' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Community Manifesto' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'A tiny move can start a giant storm.' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Stop watching candles. Watch the wings.' })).toBeInTheDocument()
    expect(screen.getByText('FIXED AMOUNT: 0.05 BNB')).toBeInTheDocument()
    expect(screen.getByText('ONE PARTICIPATION PER ADDRESS')).toBeInTheDocument()
    expect(screen.getByText(/Participate only through this page/)).toBeInTheDocument()
    expect(screen.getByText(/FLAP is a pure community Meme token/)).toBeInTheDocument()
    expect(screen.getByText('PRESALE IS FLAPPING')).toBeInTheDocument()
    expect(screen.getByText('FIXED 0.05 BNB')).toBeInTheDocument()
    expect(container.querySelector('.ticker')).toHaveTextContent('$FLAP · WINGS UP · $FLAP')
    expect(container.querySelector('.hero-poster-note')).toHaveTextContent("DON'T WATCH THE WINDFLAP IT INTO MOTION")
    expect(container.querySelector('.mobile-presale-dock a')).toHaveAttribute('aria-label', 'Join the FLAP STOCK presale with 0.05 BNB')
    expect(container.querySelector('.mobile-presale-dock a')).toHaveAttribute('href', '#presale')
    expect(document.documentElement.lang).toBe('en')
  })

  it('lets mobile visitors open the compact navigation and closes it after selection', () => {
    render(<App />)

    const menuButton = document.querySelector('.menu-toggle') as HTMLButtonElement
    const navigation = screen.getByRole('navigation', { name: '主导航' })

    expect(menuButton).toHaveAttribute('aria-label', '打开菜单')
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
    expect(navigation).toHaveAttribute('data-open', 'false')

    fireEvent.click(menuButton)

    expect(menuButton).toHaveAttribute('aria-label', '关闭菜单')
    expect(menuButton).toHaveAttribute('aria-expanded', 'true')
    expect(navigation).toHaveAttribute('data-open', 'true')

    fireEvent.click(within(navigation).getByRole('link', { name: '蝴蝶效应' }))

    expect(menuButton).toHaveAttribute('aria-label', '打开菜单')
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
    expect(navigation).toHaveAttribute('data-open', 'false')
  })

  it('renders the binding story, signals, character core, presale, roadmap, and manifesto copy', () => {
    const { container } = render(<App />)
    const effect = screen.getByRole('region', { name: '蝴蝶效应' })
    const signal = screen.getByRole('region', { name: 'Meme 信号终端' })
    const nameCore = screen.getByRole('region', { name: '蝴蝶股票四字内核' })
    const presale = screen.getByRole('region', { name: '预售控制台' })
    const participation = screen.getByRole('region', { name: '参与方式' })
    const roadmap = screen.getByRole('region', { name: '路线图' })
    const manifesto = screen.getByRole('region', { name: '社区宣言' })

    expect(within(effect).getByRole('heading', { name: '一点点动静，也能掀起大风暴。' })).toBeInTheDocument()
    ;['你先振翅', '社区接力', '万蝶成风'].forEach((phrase) => expect(within(effect).getByRole('heading', { name: phrase })).toBeInTheDocument())
    ;['振翅频率', '传播风向', '蝴蝶密度', '风暴状态'].forEach((metric) => expect(within(signal).getByText(metric)).toBeInTheDocument())
    expect(within(signal).getAllByText(/非金融数据/)).toHaveLength(4)
    expect([...nameCore.querySelectorAll('.name-core-glyph')].map((glyph) => glyph.textContent)).toEqual(['蝴', '蝶', '股', '票'])
    expect(within(nameCore).getByText(/不代表真实股权、股票、证券/)).toBeInTheDocument()
    ;['网络：BSC 主网', '固定金额：0.05 BNB', '每个地址限参与一次', '最多 10,000 个地址', '截止：北京时间 2026-09-09 23:59:59', 'FLAP 将在预售后人工发放', '不退款'].forEach((fact) => expect(within(presale).getByText(fact)).toBeInTheDocument())
    expect(within(presale).queryByRole('link')).not.toBeInTheDocument()
    ;['BSC 钱包', '官方预售合约', 'BSC 主网', '固定金额', '官方合约地址', '交易记录', '人工发放'].forEach((term) => expect(within(participation).getAllByText(new RegExp(term)).length).toBeGreaterThan(0))
    ;['FLAP', 'SWARM', 'STORM'].forEach((code) => expect(within(roadmap).getByText(code)).toBeInTheDocument())
    expect(within(roadmap).getByText(/官方后续公告为准/)).toBeInTheDocument()
    expect(within(manifesto).getByRole('heading', { name: '不预测风口，我们把风扇起来。' })).toBeInTheDocument()

    ;['effect-section', 'signal-section', 'name-core-section', 'presale-section', 'participation-section', 'roadmap-section', 'manifesto-section'].forEach((className) => {
      expect(container.querySelector(`.${className}`), className).toBeInTheDocument()
    })
  })

  it('exposes named regions while hiding decorative visual layers', () => {
    const { container } = render(<App />)

    expect(screen.getAllByRole('region')).toHaveLength(9)
    expect(container.querySelector('.site-grid')).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('.ticker')).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('.hero-visual img')).toHaveAttribute('alt', '')
    expect(screen.getByRole('button', { name: '切换到英文' })).toBeInTheDocument()
  })

  it('defines the requested tablet, mobile, and narrow-phone responsive contracts', () => {
    expect(css).toContain('@media (max-width: 1024px)')
    expect(css).toContain('@media (max-width: 760px)')
    expect(css).toContain('@media (max-width: 360px)')
    expect(css).toMatch(/@media \(max-width: 1024px\)[\s\S]*?\.effect-grid,[\s\S]*?\.signal-grid,[\s\S]*?\.name-core-grid,[\s\S]*?\.participation-grid\s*\{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.name-core-grid\s*\{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.signal-grid\s*\{[\s\S]*?scroll-snap-type: x mandatory/)
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.hero-actions \.button\s*\{[\s\S]*?width: 100%/)
    expect(css.match(/@media \(max-width: 760px\)/g)).toHaveLength(1)
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.brand-lockup\s*\{[\s\S]*?min-height: 44px[\s\S]*?min-width: 44px/)
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*?nav a\s*\{[\s\S]*?min-height: 44px[\s\S]*?min-width: 44px/)
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.menu-toggle\s*\{[\s\S]*?display: flex/)
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.mobile-presale-dock\s*\{[\s\S]*?display: grid/)
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.hero-visual\s*\{[\s\S]*?min-height: 290px/)
    expect(css).toMatch(/#presale > ul \{[^}]*display: grid;[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.mobile-presale-dock > a\s*\{[\s\S]*?min-height: 54px/)
    expect(css).toContain('padding-bottom: calc(96px + env(safe-area-inset-bottom))')
  })

  it('keeps the mobile conversion dock and hero atmosphere decorative but accessible', () => {
    const { container } = render(<App />)

    expect(container.querySelector('.mobile-presale-dock')).toBeInTheDocument()
    expect(container.querySelector('.butterfly-stage')).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelectorAll('.hero-quick-facts li')).toHaveLength(3)
  })

  it('provides a repeatable browser QA harness for every target viewport', () => {
    ;[320, 375, 768, 1440].forEach((width) => expect(responsiveQa).toContain(`width: ${width}`))
    expect(responsiveQa).toContain('document.documentElement.scrollWidth <= window.innerWidth')
    expect(responsiveQa).toContain('[role="note"]')
    expect(responsiveQa).toContain('rect.left >= 0')
    expect(responsiveQa).toContain('rect.right <= window.innerWidth')
    expect(responsiveQa).toContain('controlsDoNotOverlap')
    expect(responsiveQa).toContain('mobileButterflyVisible')
    expect(responsiveQa).toContain('mobileButterflyAnimated')
    expect(responsiveQa).toContain('/蝴蝶效应|EFFECT/')
    expect(responsiveQa).not.toContain('/故事|STORY/')
    expect(responsiveQa).toMatch(/first\.left < second\.right[\s\S]*first\.right > second\.left[\s\S]*first\.top < second\.bottom[\s\S]*first\.bottom > second\.top/)
  })
})
