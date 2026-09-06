# 蝴蝶股票 Acid Neon Redesign

## Scope

Architectural visual redesign of the existing bilingual React/Vite site. Preserve the verified BSC presale contract and transaction flow while replacing the black-gold presentation with a system derived from the supplied 蝴蝶股票 avatar.

## Brand system

- Primary lime: `#C8FF00`
- Electric purple: `#5B20FF`
- Ink: `#10051F`
- Soft paper: `#F6F5EC`
- Visual language: oversized Chinese display type, thick outlines, rounded poster blocks, sticker-like labels, high-contrast editorial grids.
- The supplied avatar is the canonical logo and hero artwork.

## Experience

- Chinese remains the default; every user-visible label and risk disclosure has an English equivalent.
- Mobile is the primary layout. The first viewport contains the animated butterfly, project name, live presale state, fixed 0.05 BNB rule and direct presale CTA.
- Desktop uses a two-column poster hero and keeps the same information hierarchy.
- Sections alternate lime, purple, ink and soft-paper surfaces to avoid lime fatigue.
- Motion is limited to the avatar, ticker and small ambient accents; reduced-motion users receive a static experience.

## Copy direction

- Core line: `一扇起飞，万蝶共振。`
- Supporting line: `不预测风口，我们把风扇起来。`
- Presale framing: `0.05 BNB，一张风暴入场券。`
- Character story: 蝴 = 起点，蝶 = 蜕变，股 = 共同持有的注意力，票 = 风暴入场券。
- The site must continue to state clearly that FLAP is a Meme token, not real stock, equity, a security, or an investment product.

## Preserved facts

- BNB Smart Chain mainnet
- Presale contract: `0x409c9448172b0f244a6823e91ad669281294622b`
- Fixed participation: `0.05 BNB`
- One participation per address
- Maximum 10,000 addresses
- Deadline: 2026-09-09 23:59:59 UTC+8
- Manual FLAP distribution and no refunds
- Recipient: `0xc46fC8D76Ad6Db1a0f88d97EbF5Aa3c405d177C2`

## Acceptance criteria

- No horizontal overflow at 320, 375, 768 and 1440 pixels.
- Mobile hero visibly contains an animated butterfly.
- Touch targets are at least 44 pixels.
- Chinese/English switch updates all visible copy.
- Presale wallet interaction and safety checks remain covered by existing tests.
- Build, unit tests, responsive QA and visual browser QA pass before production release.
