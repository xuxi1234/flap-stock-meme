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
    expect(siteContent.zh.presale.interaction.disclosure).toContain('数量及发放时间尚未公布')
    expect(siteContent.en.presale.interaction.disclosure).toContain('amount and distribution schedule are not announced')
  })

  it('removes obsolete section content and corresponding references in both languages', () => {
    for (const copy of Object.values(siteContent)) {
      expect(copy).not.toHaveProperty('participationRules')
      expect(copy).not.toHaveProperty('howTo')
      expect(copy).not.toHaveProperty('faq')
      expect(copy.footer).not.toHaveProperty('disclaimer')
      expect(copy.nameCore).not.toHaveProperty('disclaimer')
      expect(copy.hero.tagline).not.toMatch(/规则|RULES/)
      expect(copy.updates.shareText).not.toMatch(/完整规则|complete rules/)
    }
  })

  it('keeps transaction phases distinct in both languages', () => {
    Object.values(siteContent).forEach(({ presale }) => {
      const labels = presale.interaction
      expect(new Set([labels.waitingSignature, labels.broadcast, labels.confirming, labels.confirmed, labels.rejected, labels.failed, labels.uncertain]).size).toBe(7)
    })
  })
})
