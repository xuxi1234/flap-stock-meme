import type { Language } from '../content/siteContent'
import { projectConfig } from '../config/project'
import { communityLogos } from '../config/communityLogos'

export function CommunitySection({ language }: { language: Language }) {
  const zh = language === 'zh'
  const channels = [
    { id: 'qq', name: 'QQ', body: zh ? '加入蝴蝶股票 QQ 群，一起交流。' : 'Join the 蝴蝶股票 QQ group and chat with the community.' },
    { id: 'x', name: 'X', body: zh ? '关注项目动态与公开公告。' : 'Follow project updates and announcements.' },
    { id: 'telegram', name: 'Telegram', body: zh ? '加入交流，分享问题与想法。' : 'Join the conversation and share questions.' },
    { id: 'debox', name: 'DeBox', body: zh ? '走进社区，关注活动与讨论。' : 'Explore community activities and discussions.' },
  ] as const
  return <section className="statement community-section" id="community" aria-label={zh ? '加入社区' : 'Join the community'}>
    <p className="eyebrow">COMMUNITY</p><h2>{zh ? '故事，从相遇开始。' : 'THE STORY STARTS WITH US.'}</h2>
    <div className="community-cards">{channels.map(c => <a key={c.id} href={projectConfig.community[c.id]} target="_blank" rel="noopener noreferrer"><img src={communityLogos[c.id]} alt="" width="40" height="40" /><h3>{c.name}<span aria-hidden="true">↗</span></h3><p>{c.body}</p></a>)}</div>
  </section>
}
