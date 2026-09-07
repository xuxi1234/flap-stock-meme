import type { Language } from '../content/siteContent'

// Set this only after the project supplies and verifies the FLAP token contract.
export const flapTokenAddress: string | null = null

export function TokenMechanism({ language }: { language: Language }) {
  const zh = language === 'zh'
  const groups = [
    { title: zh ? '代币税收分配' : 'TOKEN TAX ALLOCATION', note: zh ? '以下为所收税款的分配占比，总交易税率待公布。' : 'Shares of collected tax. The total trading tax rate is not yet announced.', rows: [
      ['77%', zh ? '金库' : 'Treasury'], ['17%', zh ? '分红美股 QQQB' : 'QQQB rewards'], ['6%', zh ? '销毁' : 'Burn'],
    ] },
    { title: zh ? '金库内部分配' : 'TREASURY ALLOCATION', note: zh ? '以下比例以进入金库的资金为基数。' : 'These shares apply to funds allocated to the treasury.', rows: [
      ['0.1%', zh ? '裂变回购' : 'Referral buyback'], ['30%', zh ? '溢价池' : 'Premium pool'], ['69.9%', zh ? '锁仓分红' : 'Locked-token rewards'],
    ] },
  ]
  return <section className="statement token-mechanism" id="mechanism" aria-label={zh ? '代币机制' : 'Token mechanism'}>
    <p className="eyebrow">FLAP / TOKENOMICS</p>
    <h2>{zh ? '蝴蝶股票，机制一目了然。' : 'FLAP STOCK. THE ALLOCATION.'}</h2>
    <div className="mechanism-groups">{groups.map(group => <article className="mechanism-group" key={group.title}>
      <h3>{group.title}</h3><p>{group.note}</p>
      <dl>{group.rows.map(([value, label]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </article>)}</div>
    <div className="token-address-slot"><span>{zh ? '蝴蝶股票代币合约地址' : 'FLAP STOCK TOKEN CONTRACT'}</span>
      {flapTokenAddress ? <a href={`https://bscscan.com/address/${flapTokenAddress}`} target="_blank" rel="noreferrer">{flapTokenAddress}</a> : <strong>{zh ? '待公布' : 'COMING SOON'}</strong>}
      <p>{zh ? '机制方案已公布，待代币合约发布后核对链上实现。' : 'Proposed allocation. On-chain implementation will be checked after the token contract is published.'}</p>
    </div>
  </section>
}
