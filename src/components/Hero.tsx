import { useState } from 'react'
import type { Language, SiteCopy } from '../content/siteContent'
import { projectConfig } from '../config/project'

type Props = { copy: SiteCopy['hero']; language?: Language; onWalletClick?: () => void }

export function Hero({ copy, language = 'zh' }: Props) {
  const [copyStatus, setCopyStatus] = useState('')
  async function copyContract() {
    try { await navigator.clipboard.writeText(projectConfig.token.contractAddress ?? ''); setCopyStatus(language === 'zh' ? '合约地址已复制' : 'Contract address copied') }
    catch { setCopyStatus(language === 'zh' ? '复制失败，请长按或选中下方地址复制' : 'Copy failed. Select the address below to copy it.') }
  }

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1 id="hero-title"><span className="hero-title-wave" aria-label={projectConfig.brand.chineseName}>{Array.from(projectConfig.brand.chineseName).map((character, index) => <b className="hero-title-letter" aria-hidden="true" key={index} style={{ animationDelay: `${index * 0.1}s` }}>{character}</b>)}</span><em>{projectConfig.brand.englishName}</em></h1>
        <p className="hero-tagline">{copy.tagline}</p>
        <div className="hero-description hero-description-compact">
          <p>{language === 'zh' ? <>BNB Chain 上的社区 Meme 项目。了解代币机制、探索 7,777 张蝴蝶 NFT，或查看美股动态。</> : <>A community Meme project on BNB Chain. Explore the token mechanics, discover 7,777 butterfly NFTs, or follow US markets.</>}</p>
        </div>
        <div className="hero-actions">
          <a className="button button-primary" href={`/nft?lang=${language}`}>{language === 'zh' ? '探索与铸造 NFT ↗' : 'EXPLORE & MINT NFT ↗'}</a>
          <a className="button button-secondary" href="#mechanism">{copy.brandSignalLabel}</a>
        </div>
        <p className="hero-action-note">{language === 'zh' ? 'NFT 每张 0.01 BNB · 邀请人选填 · 浏览无需连接钱包' : 'NFTs: 0.01 BNB each · Inviter optional · Browse without a wallet'}</p>
        <div className="hero-contract-box">
          <div><strong>{language === 'zh' ? '蝴蝶股票代币合约 · BNB Chain' : 'FLAP STOCK TOKEN · BNB CHAIN'}</strong><button type="button" onClick={() => void copyContract()}>{language === 'zh' ? '复制合约' : 'Copy contract'}</button></div>
          <a href={`https://bscscan.com/token/${projectConfig.token.contractAddress}`} target="_blank" rel="noreferrer">{projectConfig.token.contractAddress} ↗</a>
          <span role="status">{copyStatus}</span>
        </div>
        <details className="hero-project-details"><summary>{language === 'zh' ? '项目介绍与官方链接' : 'Project details & official links'}</summary>
          <p>{language === 'zh' ? '机制包括蝴蝶股票金库、QQQB 奖励分配与销毁；金库内部分配见下方代币机制。' : 'The mechanism includes the FLAP STOCK treasury, QQQB rewards and burning. Treasury allocations are explained below.'}</p>
          <a href="https://gupiao.sh">gupiao.sh ↗</a><a href="https://flap.sh" target="_blank" rel="noreferrer">Flap.SH ↗</a>
        </details>
      </div>
      <a className="hero-visual" href="#mechanism" aria-label={copy.brandSignalLabel}>
        <span className="hero-visual-status" aria-hidden="true">{projectConfig.brand.chineseName}</span>
        <p className="ticker" aria-hidden="true">{copy.visualTicker}</p>
        <div className="butterfly-stage" aria-hidden="true"><img src="/flap-stock-avatar.png" alt="" /></div>
        <span className="hero-card-action">{copy.brandSignalLabel}</span>
      </a>
    </section>
  )
}
