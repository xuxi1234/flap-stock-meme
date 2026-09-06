import { describe, expect, it } from 'vitest'
import { projectConfig } from '../config/project'
import { siteContent } from './siteContent'

describe('participation-center content', () => {
  it('keeps matching bilingual sections and the same binding presale facts', () => {
    expect(Object.keys(siteContent.zh)).toEqual(Object.keys(siteContent.en))
    expect(projectConfig.presale.priceBnb).toBe('0.05')
    expect(projectConfig.presale.maxParticipants).toBe(10_000)
    expect(projectConfig.presale.recipientAddress).toBe('0xc46fC8D76Ad6Db1a0f88d97EbF5Aa3c405d177C2')
    expect(projectConfig.presale.contractAddress).toBe('0x409c9448172b0f244a6823e91ad669281294622b')
  })

  it('does not invent token allocation, distribution schedule, or fund-use numbers', () => {
    const zhRules = siteContent.zh.participationRules.cards.map(({ label, value, detail }) => `${label} ${value} ${detail}`).join(' ')
    const enRules = siteContent.en.participationRules.cards.map(({ label, value, detail }) => `${label} ${value} ${detail}`).join(' ')
    ;['获得 FLAP 数量', '总量与分配', '募集资金用途', '官方未公布'].forEach((term) => expect(zhRules).toContain(term))
    ;['FLAP RECEIVED', 'SUPPLY & ALLOCATION', 'USE OF BNB', 'NOT ANNOUNCED'].forEach((term) => expect(enRules).toContain(term))
  })

  it('states that the 0.2 BNB path is not open in both languages', () => {
    expect(siteContent.zh.participationRules.leaderNote).toContain('0.2 BNB 档位目前未开放')
    expect(siteContent.en.participationRules.leaderNote).toContain('0.2 BNB team-leader tier is not open')
  })

  it('keeps transaction phases distinct in both languages', () => {
    Object.values(siteContent).forEach(({ presale }) => {
      const labels = presale.interaction
      expect(new Set([labels.waitingSignature, labels.broadcast, labels.confirming, labels.confirmed, labels.rejected, labels.failed, labels.uncertain]).size).toBe(7)
    })
  })
})
