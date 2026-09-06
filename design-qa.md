# Design QA — 蝴蝶股票 Acid Neon

## Source

Supplied square avatar with acid-lime background, electric-purple butterfly, upward arrow and bold Chinese wordmark.

## Comparison

- Palette: source lime and purple are now the primary interface colors; ink and paper are used only for contrast and legibility.
- Shape language: the avatar's rounded butterfly geometry is reflected in the hero chamber, pill navigation and poster cards.
- Typography: oversized, tightly spaced Chinese display text matches the source's high-impact wordmark character.
- Hero asset: the supplied avatar is used directly, without redrawing or approximating it.
- Motion: the source avatar uses the `mobileWingFlap` animation on desktop and mobile, with a reduced-motion fallback.

## Browser checks

- Desktop: 1363px viewport, no horizontal overflow; animated avatar visible; bilingual switch works; presale CTA targets `#presale`.
- Mobile: 375px viewport, no horizontal overflow; butterfly visible above the fold; menu and fixed presale dock visible.
- Narrow mobile: 320px viewport, `scrollWidth === innerWidth`; no interactive control crosses the viewport; risk notes remain within bounds.
- Presale: live console renders the verified contract warning and `CONNECT BSC WALLET` state without changing transaction behavior.
- Console: no application errors observed; only the cloud-browser extension's unrelated metadata warning appeared.

## Findings

- P0: none
- P1: none
- P2: none
- P3: remote display fonts fall back to local system fonts if Google Fonts is unavailable; layout remains stable.

final result: passed
