import { useEffect, useState } from 'react'
import type { Language } from '../content/siteContent'

export const presaleShareUrl = 'https://www.hudiegupiao.com/?utm_source=community&utm_medium=share&utm_campaign=presale#presale'

export function PresaleShare({ language, account, onConnect }: { onConnect: () => void; language: Language; account: `0x${string}` | null }) {
  const zh = language === 'zh'
  const [status, setStatus] = useState('')
  useEffect(() => setStatus(''), [account, language])
  const url = new URL(presaleShareUrl)
  if (account) url.searchParams.set('ref', account)
  const shareUrl = account ? url.toString() : ''
  const copy = async () => {
    if (!account) return
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(shareUrl)
      setStatus(zh ? '分享链接已复制' : 'Share link copied')
    } catch { setStatus(zh ? '请长按或选中下方链接复制' : 'Select the link below and copy it manually') }
  }
  const share = async () => {
    if (!account) return
    if (!navigator.share) return copy()
    try { await navigator.share({ title: '蝴蝶股票 | FLAP STOCK', text: zh ? '蝴蝶股票预售：BSC 主网，每地址固定 0.05 BNB。参与前请查看官网条件与实时状态。' : 'FLAP STOCK presale: fixed 0.05 BNB per address on BSC. Check the terms and live status before joining.', url: shareUrl }) }
    catch (error) { if (!(error instanceof Error && error.name === 'AbortError')) setStatus(zh ? '分享未完成，可以复制链接' : 'Sharing did not complete. You can copy the link.') }
  }
  return <div className="presale-share" aria-label={zh ? '分享预售' : 'Share presale'}>
    <h3>{zh ? '请把蝴蝶股票分享给您的朋友们' : 'PLEASE SHARE 蝴蝶股票 WITH YOUR FRIENDS'}</h3>
    {!account && <p><button className="button button-primary" type="button" onClick={onConnect}>{zh ? '请先连接钱包，生成专属分享链接' : 'Connect your wallet to create your share link'}</button></p>}
    <div className="hero-actions"><button disabled={!account} className="button button-primary" onClick={() => void share()}>{zh ? '分享' : 'SHARE'}</button><button disabled={!account} className="button" onClick={() => void copy()}>{zh ? '复制分享链接' : 'COPY SHARE LINK'}</button></div>
    <input aria-label={zh ? '预售分享链接' : 'Presale share link'} placeholder={zh ? '连接钱包后显示含钱包地址的链接' : 'Your wallet share link appears after connecting'} value={shareUrl} readOnly onFocus={event => event.target.select()} />
    <p role="status">{status}</p>
  </div>
}
