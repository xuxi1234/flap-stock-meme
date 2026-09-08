import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'

// Version the existing logo without changing the artwork. Old social caches can
// still hold the original URL, while new crawls receive this stable public asset.
copyFileSync('dist/flap-stock-avatar.png', 'dist/flap-stock-share-v2.png')
const html = readFileSync('dist/index.html', 'utf8')
const canonical = 'https://www.hudiegupiao.com/'
const share = canonical + 'share.html'
const marker = '<meta property="og:url" content="' + canonical + '" />'
if (!html.includes(marker) || !html.includes('og:image:width') || !html.includes('flap-stock-share-v2.png')) {
  throw new Error('Required server-rendered social metadata is missing')
}
// This is the built homepage with its actual JS/CSS bundles, not a redirect or
// a bot-only page. Its own Open Graph identity gives new shares a fresh URL.
writeFileSync('dist/share.html', html.replace(marker, '<meta property="og:url" content="' + share + '" />'))
