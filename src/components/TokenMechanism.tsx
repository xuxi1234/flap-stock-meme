import type { Language } from '../content/siteContent'

export const flapTokenAddress: string | null = null

export function TokenMechanism({ language }: { language: Language }) {
  const zh = language === 'zh'
  const first = [
    ['77%', zh ? '蝴蝶股票金库' : '蝴蝶股票 Treasury', zh ? '进入金库后，按下方第二层方案分配。' : 'Allocated again through the treasury plan below.'],
    ['17%', zh ? 'QQQB 奖励' : 'QQQB rewards', zh ? '用于 QQQB 奖励分配。' : 'Allocated to QQQB rewards.'],
    ['6%', zh ? '销毁' : 'Burn', zh ? '用于代币销毁。' : 'Allocated to token burning.'],
  ]
  const second = [
    ['0.1%', zh ? '裂变回购' : 'Referral buyback'],
    ['30%', zh ? '蝴蝶股票溢价池' : '蝴蝶股票 Premium pool'],
    ['69.9%', zh ? '锁仓分红' : 'Locked-token rewards'],
  ]
  return <section className="statement token-mechanism" id="mechanism" aria-label={zh ? '代币机制' : 'Token mechanism'}>
    <p className="eyebrow">TOKENOMICS</p>
    <h2>{zh ? '一笔税款，两层分配。' : 'ONE TAX FLOW. TWO LAYERS.'}</h2>
    <p className="mechanism-status">{zh ? '总交易税率：待公布' : 'TOTAL TRADING TAX RATE: NOT ANNOUNCED'}</p>
    <p className="mechanism-intro">{zh ? '下面的百分比表示税款如何分配，并非每笔交易的税率。' : 'The percentages below describe how collected tax is allocated, not the tax rate on each trade.'}</p>
    <h3 className="allocation-heading">{zh ? '第一层 · 交易税款如何分配' : 'LAYER 1 · ALLOCATION OF COLLECTED TAX'}</h3>
    <div className="allocation-grid primary-allocation">{first.map(([value, title, body], i) => <article className={i === 0 ? 'allocation-card treasury-source' : 'allocation-card'} key={title}>
      <span className="allocation-value">{value}</span><h3>{title}</h3><p>{body}</p>
      {i === 0 && <a className="treasury-jump" href="#treasury">{zh ? '查看金库内部分配 ↓' : 'TREASURY BREAKDOWN ↓'}</a>}
    </article>)}</div>
    <div className="treasury-branch" id="treasury">
      <p className="treasury-origin">{zh ? '来自第一层的 77% 金库份额 ↓' : 'FROM THE 77% TREASURY SHARE ABOVE ↓'}</p>
      <h3 className="allocation-heading">{zh ? '第二层 · 这 77% 进入蝴蝶股票金库后，再分配' : 'LAYER 2 · WITHIN THAT 77% 蝴蝶股票 TREASURY SHARE'}</h3>
      <p>{zh ? '每收到 100 份税款，77 份进入蝴蝶股票金库；下面三项比例，以这 77 份为基数。' : 'For every 100 units of tax, 77 go to the 蝴蝶股票 treasury. The three percentages below apply only to those 77 units.'}</p>
      <div className="allocation-grid">{second.map(([value, title]) => <article className="allocation-card" key={title}>
        <span className="allocation-value">{value}</span><h3>{title}</h3>
      </article>)}</div>
    </div>
    <div className="contract-status-row"><span>{zh ? '蝴蝶股票代币合约' : 'FLAP STOCK TOKEN CONTRACT'}</span>
      {flapTokenAddress ? <a href={`https://bscscan.com/address/${flapTokenAddress}`} target="_blank" rel="noreferrer">{flapTokenAddress}</a> : <strong>{zh ? '待公布' : 'NOT ANNOUNCED'}</strong>}
    </div>
    <p className="mechanism-footnote">{zh ? '以上为机制方案。具体资产、持有人权益及链上实现，待合约和完整规则公布后核对。' : 'This is a proposed mechanism. Asset details, holder rights and on-chain implementation await the contract and complete rules.'}</p>
  </section>
}
