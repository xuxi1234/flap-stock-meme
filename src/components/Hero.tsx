import type { Language, SiteCopy } from '../content/siteContent'
import { projectConfig } from '../config/project'

type Props = { copy: SiteCopy['hero']; language?: Language; onWalletClick?: () => void }

export function Hero({ copy, language = 'zh', onWalletClick }: Props) {

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1 id="hero-title"><span>{projectConfig.brand.chineseName}</span><em>{projectConfig.brand.englishName}</em></h1>
        <p className="hero-tagline">{copy.tagline}</p>
        <div className="hero-description">
          <p>{language === 'zh' ? <>蝴蝶股票是基于 <strong>BNB Chain</strong> 的社区 Meme 项目，计划通过 <strong>Flap.SH 平台</strong>发射</> : <>蝴蝶股票 is a community Meme project on <strong>BNB Chain</strong>, with plans to launch through the <strong>Flap.SH platform</strong>.</>}</p>
          <p>{language === 'zh' ? '蝴蝶股票是蝴蝶平台的第一个粉红锁仓分红机制➕蝴蝶股票金库专属原创溢价出售机制' : '蝴蝶股票 is the first project on the Flap platform combining the Pink locked-token reward mechanism and an original premium-sale mechanism exclusive to the 蝴蝶股票 treasury.'}</p>
          <p>{language === 'zh' ? <>结合<strong>蝴蝶股票金库、QQQB 奖励分配及代币销毁</strong>，探索社区参与、持有激励与流动性之间的协同，旨在改善短期博弈与长期参与动力不足等问题</> : <>Combining the <strong>蝴蝶股票 treasury, QQQB reward distribution and token burning</strong>, the project explores how community participation, holding incentives and liquidity can work together, aiming to address short-term speculation and limited incentives for long-term participation.</>}</p>
          <p><strong>{language === 'zh' ? '蝴蝶股票的代币合约地址，将通过蝴蝶股票的官方渠道公布' : 'The 蝴蝶股票 token contract address will be announced through the project’s official channels.'}</strong></p>
          <div className="hero-official-links"><p><strong>{language === 'zh' ? '蝴蝶股票官网：' : '蝴蝶股票 website: '}</strong><a href="https://gupiao.sh" target="_blank" rel="noreferrer">https://gupiao.sh</a></p><p><strong>{language === 'zh' ? 'Flap 平台官网：' : 'Flap platform: '}</strong><a href="https://flap.sh" target="_blank" rel="noreferrer">https://flap.sh</a></p></div>
        </div>
        <ul className="hero-quick-facts" aria-label={copy.statusLabel}>
          {copy.quickFacts.map((fact) => <li key={fact.label}><span>{fact.label}</span><strong>{fact.value}</strong></li>)}
        </ul>
        <div className="hero-actions"><a className="button button-primary" href="#presale">{copy.enterPresale}</a><a className="button button-secondary" href="#mechanism">{copy.brandSignalLabel}</a></div>
      </div>
      <a className="hero-visual hero-presale-link" href="#presale" onClick={event => { if (onWalletClick) { event.preventDefault(); onWalletClick() } }} aria-label={copy.enterPresale}>
        <span className="hero-visual-status" aria-hidden="true">{projectConfig.brand.chineseName}</span>
        <p className="ticker" aria-hidden="true">{copy.visualTicker}</p>
        <div className="butterfly-stage" aria-hidden="true"><img src="/flap-stock-avatar.png" alt="" /></div>
        <span className="hero-card-action">{language === 'zh' ? '点击参与 · 0.05 BNB ↗' : 'JOIN · 0.05 BNB ↗'}</span>
      </a>
    </section>
  )
}
