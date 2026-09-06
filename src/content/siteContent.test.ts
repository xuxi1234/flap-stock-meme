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
    expect(projectConfig.presale.contractAddress).toBeNull()
    expect(projectConfig.presale.purchaseUrl).toBeNull()
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

  it('uses the binding butterfly-effect sequence and thesis in both languages', () => {
    expect(siteContent.zh.effect.title).toBe('没有基本面，只有蝴蝶面。')
    expect(siteContent.en.effect.title).toBe('No fundamentals, only butterfly fundamentals.')
    expect(siteContent.zh.effect.steps.map(({ title }) => title)).toEqual(['一次振翅', '一次传播', '一场风暴'])
    expect(siteContent.en.effect.steps.map(({ title }) => title)).toEqual(['ONE FLAP', 'ONE SPREAD', 'ONE STORM'])
  })

  it('defines exactly four qualitative entertainment signals', () => {
    expect(siteContent.zh.signal.metrics.map(({ label }) => label)).toEqual(['翅膀频率', '社区信号', 'Meme 引力', '风暴等级'])
    expect(siteContent.en.signal.metrics.map(({ label }) => label)).toEqual(['WING FREQUENCY', 'COMMUNITY SIGNAL', 'MEME GRAVITY', 'STORM LEVEL'])

    Object.values(siteContent).forEach(({ signal }) => {
      expect(signal.metrics).toHaveLength(4)
      signal.metrics.forEach(({ value, trend }) => expect(`${value} ${trend}`).not.toMatch(/\d/))
    })
  })

  it('keeps the four-character core and its brand-metaphor disclaimer exact', () => {
    Object.values(siteContent).forEach(({ nameCore }) => {
      expect(nameCore.cards.map(({ glyph }) => glyph)).toEqual(['蝴', '蝶', '股', '票'])
    })

    expect(siteContent.zh.nameCore.cards.map(({ title }) => title)).toEqual(['微小起点', '不断进化', '共同持有的注意力', '风暴入场券'])
    expect(siteContent.en.nameCore.cards.map(({ title }) => title)).toEqual(['SMALL BEGINNING', 'CONTINUOUS EVOLUTION', 'COMMUNITY-HELD ATTENTION', 'A TICKET INTO THE MEME STORM'])
    expect(siteContent.zh.nameCore.disclaimer).toBe('“股”和“票”仅为品牌比喻，不代表真实股权、股票、证券或证券票据。')
    expect(siteContent.en.nameCore.disclaimer).toBe('The characters 股 and 票 are brand metaphors only. They do not represent equity, real stock, securities, or securities tickets.')
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
  })

  it('covers the complete participation flow in both languages', () => {
    const zhFlow = siteContent.zh.howTo.steps.map(({ title, body }) => `${title} ${body}`).join(' ')
    const enFlow = siteContent.en.howTo.steps.map(({ title, body }) => `${title} ${body}`).join(' ').toUpperCase()

    ;['BSC 钱包', 'BNB', '官方预售合约', '网络', '金额', '官方链接', '交易记录', '人工发放'].forEach((term) => expect(zhFlow).toContain(term))
    ;['BSC WALLET', 'BNB', 'OFFICIAL PRESALE CONTRACT', 'NETWORK', 'AMOUNT', 'OFFICIAL LINK', 'TRANSACTION RECORD', 'MANUAL FLAP DISTRIBUTION'].forEach((term) => expect(enFlow).toContain(term))
  })

  it('uses FLAP, FLY, and STORM roadmap phases with the official-announcement caveat', () => {
    expect(siteContent.zh.roadmap.phases.map(({ code }) => code)).toEqual(['FLAP', 'FLY', 'STORM'])
    expect(siteContent.en.roadmap.phases.map(({ code }) => code)).toEqual(['FLAP', 'FLY', 'STORM'])
    expect(siteContent.zh.roadmap.caveat).toMatch(/以后续官方公告为准/)
    expect(siteContent.en.roadmap.caveat).toMatch(/subject to subsequent official announcements/i)
  })

  it('localizes the hero brand signal, community pending state, and closing manifesto', () => {
    expect(siteContent.zh.hero.brandSignalLabel).toBe('品牌信号')
    expect(siteContent.en.hero.safetyLabel).toBe('NOT FINANCIAL DATA')
    expect(siteContent.zh.hero.presalePendingLabel).toBe('尚未开放')
    expect(siteContent.en.hero.presalePendingLabel).toBe('COMING SOON')
    expect(siteContent.zh.community.comingSoon).toContain('COMING SOON')
    expect(siteContent.en.community.comingSoon).toBe('COMING SOON')
    expect(siteContent.zh.manifesto.title).toBe('不要预测风口，成为扇动翅膀的人。')
    expect(siteContent.en.manifesto.title).toBe('Do not predict the wind. Be the one who flaps.')
  })
})
