import { useEffect, useState } from 'react'
import { Hero } from './components/Hero'
import { NameCore } from './components/NameCore'
import { TokenMechanism } from './components/TokenMechanism'
import { CommunitySection } from './components/CommunitySection'
import { useHomeWallet } from './web3/useHomeWallet'
import { SiteFooter } from './components/SiteFooter'
import { SiteHeader } from './components/SiteHeader'
import { TickerStrip } from './components/TickerStrip'
import { siteContent, type Language } from './content/siteContent'

export default function HomePage() {
  const [language, setLanguage] = useState<Language>(() => { const value = new URLSearchParams(location.search).get('lang'); if (value === 'en' || value === 'zh') return value; try { return localStorage.getItem('butterfly-nft-language') === 'en' ? 'en' : 'zh' } catch { return 'zh' } })
  const { account, openWallet, walletDialog } = useHomeWallet(language)
  const copy = siteContent[language]
  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'
    document.title = language === 'zh' ? '蝴蝶股票｜NFT 典藏、代币机制与美股动态' : 'FLAP STOCK | NFTs, Tokenomics & US Markets'
    try { localStorage.setItem('butterfly-nft-language', language) } catch { /* Optional preference storage. */ }
    const url = new URL(location.href); url.searchParams.set('lang', language); history.replaceState(null, '', url)
  }, [language])
  return <div className="site-shell">
    <a className="home-skip" href="#top">{language === 'zh' ? '跳到主要内容' : 'Skip to main content'}</a>
    <div className="site-grid" aria-hidden="true" />
    <SiteHeader account={account} onWalletClick={openWallet} copy={copy.nav} communityCopy={copy.community} language={language} onLanguageChange={setLanguage} />
    {walletDialog}
    <main id="top" tabIndex={-1}>
      <Hero copy={copy.hero} language={language} />
      <section className="home-tools" aria-label={language === 'zh' ? '选择你要使用的功能' : 'Choose a destination'}>
        {[
          {href:`/nft?lang=${language}`,tag:'01 / NFT',title:language==='zh'?'收藏一只蝴蝶':'Collect a butterfly',body:language==='zh'?'免费开蝶体验；付费随机铸造后领取到钱包。':'Try a free reveal, or mint and claim an NFT to your wallet.',label:language==='zh'?'探索 NFT':'Explore NFTs'},
          {href:'/?view=markets',tag:'02 / MARKETS',title:language==='zh'?'关注美股动态':'Follow US markets',body:language==='zh'?'走势、新闻与自选股，无需连接钱包。':'Charts, news and watchlists. No wallet required.',label:language==='zh'?'打开美股看板':'Open market dashboard'},
          {href:'https://app.gupiao.sh/',tag:'03 / SWAP',title:language==='zh'?'查询链上报价':'Check on-chain quotes',body:language==='zh'?'查看兑换路径与费用预估；收费交易暂未开放。':'Explore routes and estimated fees. Fee-based trading is not yet open.',label:language==='zh'?'查看 Swap 报价':'View Swap quotes'}
        ].map(item=><a className="home-tool" href={item.href} key={item.tag}><span>{item.tag}</span><h2>{item.title}</h2><p>{item.body}</p><strong>{item.label} ↗</strong></a>)}
      </section>
      <TickerStrip copy={copy.ticker} />
      <TokenMechanism language={language} />
      <NameCore copy={{ ...copy.nameCore, eyebrow: 'BRAND STORY' }} />
      <section className="home-faq" aria-labelledby="home-faq-title"><p className="eyebrow">GET STARTED</p><h2 id="home-faq-title">{language==='zh'?'第一次来？从这里开始。':'New here? Start with the essentials.'}</h2>
        {[
          [language==='zh'?'浏览网站需要连接钱包吗？':'Do I need a wallet to browse?',language==='zh'?'不需要。查看项目介绍、美股动态、NFT 图片和市场挂单均无需连接钱包。铸造、领取与交易时才需要钱包确认。':'No. Explore project information, market data, artwork and NFT listings without connecting. Minting, claiming and transactions need wallet confirmation.'],
          [language==='zh'?'免费开蝶与付费铸造有什么区别？':'How does a free reveal differ from minting?',language==='zh'?'免费开蝶是浏览器中的作品体验，不会生成链上 NFT。付费铸造每张 0.01 BNB，邀请人选填；申请后等待随机编号，再分配和领取，链上操作另需 Gas。':'A free reveal is an artwork preview in your browser, not an on-chain NFT. Minting costs 0.01 BNB each with an optional inviter. Request, wait for randomness, allocate and claim; on-chain actions require gas.'],
          [language==='zh'?'如何查看我已申请的 NFT？':'Where can I find a pending mint?',language==='zh'?'使用申请时的钱包打开 NFT 页面，查看待处理申请。等待随机数时不要重复付款；按页面提示继续分配和领取。':'Open the NFT page with the wallet used for the request and check pending requests. Do not pay again while waiting for randomness; continue allocation and claim as shown.']
        ].map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}
      </section>
      <CommunitySection language={language} />
    </main>
    <SiteFooter copy={copy.footer} communityCopy={copy.community} />
  </div>
}
