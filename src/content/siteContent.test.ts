import { describe, expect, it } from 'vitest'
import { siteContent } from './siteContent'
import { projectConfig } from '../config/project'

describe('site content', () => {
  it('provides matching section keys in both languages', () => {
    expect(Object.keys(siteContent.zh)).toEqual(Object.keys(siteContent.en))
  })

  it('provides localized labels for navigation, regions, and unavailable presale actions', () => {
    expect(siteContent.zh.nav.homeLabel).toBe('FLAP STOCK 首页')
    expect(siteContent.en.nav.languageSwitchLabel).toBe('Switch to Chinese')
    expect(siteContent.zh.ticker.sectionLabel).toBe('FLAP STOCK 项目详情')
    expect(siteContent.en.effect.regionLabel).toBe('The Butterfly Effect')
    expect(siteContent.en.signal.regionLabel).toBe('Meme Signal Terminal')
    expect(siteContent.en.nameCore.regionLabel).toBe('FLAP STOCK Character Core')
    expect(siteContent.en.presale.pendingLabel).toBe('PRESALE COMING SOON')
  })

  it('keeps all confirmed presale facts in configuration', () => {
    expect(projectConfig.presale.priceBnb).toBe('0.05')
    expect(projectConfig.presale.maxParticipants).toBe(10_000)
    expect(projectConfig.presale.initialDeadline).toBe(1_788_969_599)
    expect(projectConfig.presale.deadlineUtc).toBe('2026-09-09T15:59:59Z')
    expect(projectConfig.presale.deadlineZh).toBe('北京时间 2026-09-09 23:59:59')
    expect(projectConfig.presale.recipientAddress).toBe('0xc46fC8D76Ad6Db1a0f88d97EbF5Aa3c405d177C2')
    expect(projectConfig.presale.adminAddress).toBe('0xbE37AB912De351B9312FA593C9f99e3279FDB0a2')
    expect(projectConfig.presale.contractAddress).toBe('0x409c9448172b0f244a6823e91ad669281294622b')
    expect(projectConfig.presale.purchaseUrl).toBe('#presale')
    expect(projectConfig.presale.oneParticipationPerAddress).toBe(true)
  })

  it('states the one-participation rule in both languages', () => {
    expect(siteContent.zh.presale.facts).toContain('每个地址限参与一次')
    expect(siteContent.en.presale.facts).toContain('ONE PARTICIPATION PER ADDRESS')
  })

  it('labels entertainment signals as non-financial data in both languages', () => {
    expect(siteContent.zh.signal.disclaimer).toMatch(/非金融数据/)
    expect(siteContent.en.signal.disclaimer).toMatch(/NOT FINANCIAL DATA/)
  })

  it('uses the acid-Meme butterfly-effect sequence in both languages', () => {
    expect(siteContent.zh.effect.title).toBe('一点点动静，也能掀起大风暴。')
    expect(siteContent.en.effect.title).toBe('A tiny move can start a giant storm.')
    expect(siteContent.zh.effect.steps.map(({ title }) => title)).toEqual(['你先振翅', '社区接力', '万蝶成风'])
    expect(siteContent.en.effect.steps.map(({ title }) => title)).toEqual(['YOU FLAP FIRST', 'THE SWARM CARRIES IT', 'WINGS BECOME WIND'])
  })

  it('defines exactly four qualitative entertainment signals', () => {
    expect(siteContent.zh.signal.metrics.map(({ label }) => label)).toEqual(['振翅频率', '传播风向', '蝴蝶密度', '风暴状态'])
    expect(siteContent.en.signal.metrics.map(({ label }) => label)).toEqual(['FLAP FREQUENCY', 'WIND DIRECTION', 'BUTTERFLY DENSITY', 'STORM STATUS'])

    Object.values(siteContent).forEach(({ signal }) => {
      expect(signal.metrics).toHaveLength(4)
      signal.metrics.forEach(({ value, trend }) => expect(`${value} ${trend}`).not.toMatch(/\d/))
    })
  })

  it('keeps the four-character core and its brand-metaphor disclaimer exact', () => {
    Object.values(siteContent).forEach(({ nameCore }) => {
      expect(nameCore.cards.map(({ glyph }) => glyph)).toEqual(['蝴', '蝶', '股', '票'])
    })

    expect(siteContent.zh.nameCore.cards.map(({ title }) => title)).toEqual(['一切的起点', '完成一次蜕变', '共同持有注意力', '风暴入场券'])
    expect(siteContent.en.nameCore.cards.map(({ title }) => title)).toEqual(['THE FIRST MOVE', 'THE TRANSFORMATION', 'ATTENTION HELD TOGETHER', 'A STORM TICKET'])
    expect(siteContent.zh.nameCore.disclaimer).toMatch(/不代表真实股权、股票、证券/)
    expect(siteContent.en.nameCore.disclaimer).toMatch(/do not represent equity, real stock, securities/i)
  })

  it('discloses every binding presale term in both languages', () => {
    expect(siteContent.zh.presale.facts).toEqual([
      '网络：BSC 主网',
      '固定金额：0.05 BNB',
      '每个地址限参与一次',
      '最多 10,000 个地址',
      '截止：北京时间 2026-09-09 23:59:59',
      'FLAP 将在预售后人工发放',
      '不退款',
    ])
    expect(siteContent.en.presale.facts).toEqual([
      'NETWORK: BSC MAINNET',
      'FIXED AMOUNT: 0.05 BNB',
      'ONE PARTICIPATION PER ADDRESS',
      'MAXIMUM: 10,000 ADDRESSES',
      'DEADLINE: BEIJING TIME 2026-09-09 23:59:59',
      'FLAP DISTRIBUTED MANUALLY AFTER PRESALE',
      'NO REFUNDS',
    ])
    expect(siteContent.zh.presale.actionLabel).not.toBe(siteContent.zh.presale.unavailable)
    expect(siteContent.en.presale.actionLabel).not.toBe(siteContent.en.presale.unavailable)
    expect(siteContent.zh.presale.body).toContain('现已开放')
    expect(siteContent.en.presale.body).toContain('now open')
    expect(siteContent.zh.presale.warning).toContain('0x409c9448172b0f244a6823e91ad669281294622b')
    expect(siteContent.en.presale.warning).toContain('0x409c9448172b0f244a6823e91ad669281294622b')
  })

  it('covers the complete participation flow in both languages', () => {
    const zhFlow = siteContent.zh.howTo.steps.map(({ title, body }) => `${title} ${body}`).join(' ')
    const enFlow = siteContent.en.howTo.steps.map(({ title, body }) => `${title} ${body}`).join(' ').toUpperCase()

    ;['BSC 钱包', 'BNB', '官方预售合约', 'BSC 主网', '固定金额', '官方合约地址', '交易记录', '人工发放'].forEach((term) => expect(zhFlow).toContain(term))
    ;['BSC WALLET', 'BNB', 'OFFICIAL PRESALE CONTRACT', 'BSC MAINNET', 'FIXED AMOUNT', 'OFFICIAL CONTRACT ADDRESS', 'TRANSACTION RECORD', 'MANUAL FLAP DISTRIBUTION'].forEach((term) => expect(enFlow).toContain(term))
  })

  it('uses FLAP, SWARM, and STORM roadmap phases with an announcement caveat', () => {
    expect(siteContent.zh.roadmap.phases.map(({ code }) => code)).toEqual(['FLAP', 'SWARM', 'STORM'])
    expect(siteContent.en.roadmap.phases.map(({ code }) => code)).toEqual(['FLAP', 'SWARM', 'STORM'])
    expect(siteContent.zh.roadmap.caveat).toMatch(/官方后续公告为准/)
    expect(siteContent.en.roadmap.caveat).toMatch(/official announcements/i)
  })

  it('localizes the hero brand signal, community pending state, and closing manifesto', () => {
    expect(siteContent.zh.hero.brandSignalLabel).toBe('今日 Meme 信号')
    expect(siteContent.en.hero.safetyLabel).toContain('NOT FINANCIAL DATA')
    expect(siteContent.zh.hero.presalePendingLabel).toBe('预售尚未开放')
    expect(siteContent.en.hero.presalePendingLabel).toBe('PRESALE COMING SOON')
    expect(siteContent.zh.community.comingSoon).toBe('即将开放')
    expect(siteContent.en.community.comingSoon).toBe('COMING SOON')
    expect(siteContent.zh.manifesto.title).toBe('不预测风口，我们把风扇起来。')
    expect(siteContent.en.manifesto.title).toBe('We do not predict the wind. We flap it into motion.')
  })

  it('localizes every visible hero poster line', () => {
    expect(siteContent.zh.hero.visualTicker).toBe('$FLAP · 振翅向上 · $FLAP')
    expect(siteContent.en.hero.visualTicker).toBe('$FLAP · WINGS UP · $FLAP')
    expect(siteContent.zh.hero.posterLineOne).toBe('别等风来')
    expect(siteContent.zh.hero.posterLineTwo).toBe('把风扇起来')
    expect(siteContent.en.hero.posterLineOne).toBe("DON'T WATCH THE WIND")
    expect(siteContent.en.hero.posterLineTwo).toBe('FLAP IT INTO MOTION')
  })
})
