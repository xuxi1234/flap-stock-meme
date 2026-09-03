import type { SiteCopy } from '../content/siteContent'
import { CommunityLinks } from './CommunityLinks'

type Props = { copy: SiteCopy['footer']; communityCopy: SiteCopy['community'] }

export function SiteFooter({ copy, communityCopy }: Props) {
  return <footer className="site-footer"><p>{copy.rights}</p><CommunityLinks className="footer-community" copy={communityCopy} /><p className="disclaimer">{copy.disclaimer}</p></footer>
}
