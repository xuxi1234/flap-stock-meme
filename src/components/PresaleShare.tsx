import { useState } from 'react'
import type { Language } from '../content/siteContent'

export const presaleShareUrl = 'https://www.hudiegupiao.com/?utm_source=community&utm_medium=share&utm_campaign=presale#presale'

export function PresaleShare({ language }: { language: Language }) {
  const zh = language === 'zh'
  const [status, setStatus] = useState('')
  const copy = async () => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(presaleShareUrl)
      setStatus(zh ? '分享链接已复制' : 'Share link copied')
    } catch { setStatus(zh ? '请长按或选中下方链接复制' : 'Select the link below and copy it manually') }
  }
  const share = async () => {
    if (!navigator.share) return copy()
    try { await navigator.share({ title: '蝴蝶股票 | FLAP STOCK', text: zh ? '蝴蝶股票预售：BSC 主网，每地址固定 0.05 BNB。参与前请查看官网条件与实时状态。' : 'FLAP STOCK presale: fixed 0.05 BNB per address on BSC. Check the terms and live status before joining.', url: presaleShareUrl }) }
    catch (error) { if (!(error instanceof Error && error.name === 'AbortError')) setStatus(zh ? '分享未完成，可以复制链接' : 'Sharing did not complete. You can copy the link.') }
  }
  return <div className="presale-share" aria-label={zh ? '分享预售' : 'Share presale'}>
    <h3>{zh ? '把蝴蝶分享给朋友' : 'SHARE FLAP WITH FRIENDS'}</h3>
    <div className="hero-actions"><button className="button button-primary" onClick={() => void share()}>{zh ? '分享' : 'SHARE'}</button><button className="button" onClick={() => void copy()}>{zh ? '复制分享链接' : 'COPY SHARE LINK'}</button></div>
    <input aria-label={zh ? '预售分享链接' : 'Presale share link'} value={presaleShareUrl} readOnly onFocus={event => event.target.select()} />
    <p role="status">{status}</p>
  </div>
}
