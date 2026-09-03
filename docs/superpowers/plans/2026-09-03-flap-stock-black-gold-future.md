# FLAP STOCK Black-Gold Future Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current sparse FLAP STOCK landing page with a full ten-section black-gold futuristic Meme site that is completely bilingual and responsive without enabling undeployed presale transactions.

**Architecture:** Keep the existing React/Vite static application and central project configuration. Move all localized copy into a typed content module, split the page into focused presentational sections, and keep presale availability derived only from `projectConfig.presale.contractAddress` and `purchaseUrl`. Use CSS for visual effects and responsive behavior so the site remains lightweight.

**Tech Stack:** React, TypeScript, Vite, CSS, Vitest, Testing Library, Vercel

**Spec:** `docs/superpowers/specs/2026-09-03-flap-stock-black-gold-future-design.md`

## Global Constraints

- Default language is simplified Chinese; English must cover every visible label, rule, state, warning, and accessibility label.
- Preserve the supplied `public/flap-stock-logo.png` as the central brand asset.
- Do not add WebGL, audio, remote image dependencies, fake price, fake volume, fake participant count, fake funding progress, or investment promises.
- Entertainment indicators must include `NOT FINANCIAL DATA` or its Chinese equivalent.
- Presale remains disabled while `projectConfig.presale.contractAddress` and `purchaseUrl` are null.
- Presale rules remain fixed at 0.05 BNB, one participation per address, 10,000 addresses maximum, and 2026-09-09 23:59:59 UTC+8 deadline.
- Mobile layouts retain the same core content and presale warnings as desktop.
- Support widths 320px, 375px, 768px, and 1440px without horizontal overflow.
- Respect `prefers-reduced-motion` and preserve minimum 44px touch targets on mobile.

---

### Task 1: Typed bilingual content and immutable presale facts

**Files:**
- Create: `src/content/siteContent.ts`
- Modify: `src/config/project.ts`
- Create: `src/content/siteContent.test.ts`

**Interfaces:**
- Produces: `type Language = 'zh' | 'en'`
- Produces: `type SiteCopy` describing all localized navigation, hero, effect, signal, name-core, presale, participation, roadmap, manifesto, and footer content.
- Produces: `siteContent: Record<Language, SiteCopy>`
- Produces: `projectConfig.presale.priceBnb`, `maxParticipants`, `deadlineUtc`, `deadlineZh`, `recipientAddress`, and `adminAddress`.

- [ ] **Step 1: Write the failing content tests**

```ts
import { describe, expect, it } from 'vitest'
import { siteContent } from './siteContent'
import { projectConfig } from '../config/project'

describe('site content', () => {
  it('provides matching section keys in both languages', () => {
    expect(Object.keys(siteContent.zh)).toEqual(Object.keys(siteContent.en))
  })

  it('keeps all confirmed presale facts in configuration', () => {
    expect(projectConfig.presale.priceBnb).toBe('0.05')
    expect(projectConfig.presale.maxParticipants).toBe(10_000)
    expect(projectConfig.presale.deadlineUtc).toBe('2026-09-09T15:59:59Z')
    expect(projectConfig.presale.contractAddress).toBeNull()
    expect(projectConfig.presale.purchaseUrl).toBeNull()
  })

  it('labels entertainment signals as non-financial data in both languages', () => {
    expect(siteContent.zh.signal.disclaimer).toMatch(/非金融数据/)
    expect(siteContent.en.signal.disclaimer).toMatch(/NOT FINANCIAL DATA/)
  })
})
```

- [ ] **Step 2: Run the content test and verify it fails**

Run: `npm test -- --run src/content/siteContent.test.ts`

Expected: FAIL because `siteContent.ts` and the new presale fields do not exist.

- [ ] **Step 3: Add immutable presale configuration**

Extend `projectConfig.presale` with:

```ts
priceBnb: '0.05',
maxParticipants: 10_000,
deadlineUtc: '2026-09-09T15:59:59Z',
deadlineZh: '北京时间 2026-09-09 23:59:59',
recipientAddress: '0x59389BDb944a4d8D4747b373b665a781d8DCD420',
adminAddress: '0xbE37AB912De351B9312FA593C9f99e3279FDB0a2',
```

- [ ] **Step 4: Implement the typed bilingual content module**

Create complete `zh` and `en` objects with identical keys. Include these exact structural fields:

```ts
export type SiteCopy = {
  nav: { story: string; signal: string; presale: string; roadmap: string; languageLabel: string }
  hero: { eyebrow: string; tagline: string; description: string; explore: string; enterPresale: string }
  effect: { eyebrow: string; title: string; body: string; steps: Array<{ index: string; title: string; body: string }> }
  signal: { eyebrow: string; title: string; disclaimer: string; metrics: Array<{ label: string; value: string; trend: string }> }
  nameCore: { eyebrow: string; title: string; cards: Array<{ glyph: string; title: string; body: string }> }
  presale: { eyebrow: string; title: string; body: string; facts: string[]; unavailable: string; warning: string }
  howTo: { eyebrow: string; title: string; steps: Array<{ index: string; title: string; body: string }> }
  roadmap: { eyebrow: string; title: string; phases: Array<{ code: string; title: string; body: string; status: string }> }
  manifesto: { eyebrow: string; title: string; body: string }
  footer: { disclaimer: string; rights: string }
}
```

- [ ] **Step 5: Run the content test and all existing tests**

Run: `npm test -- --run`

Expected: all tests pass.

- [ ] **Step 6: Commit Task 1**

```bash
git add src/config/project.ts src/content/siteContent.ts src/content/siteContent.test.ts
git commit -m "feat: centralize FLAP STOCK bilingual content"
```

---

### Task 2: Componentized ten-section narrative page

**Files:**
- Create: `src/components/SiteHeader.tsx`
- Create: `src/components/Hero.tsx`
- Create: `src/components/TickerStrip.tsx`
- Create: `src/components/ButterflyEffect.tsx`
- Create: `src/components/SignalTerminal.tsx`
- Create: `src/components/NameCore.tsx`
- Create: `src/components/PresaleConsole.tsx`
- Create: `src/components/HowToJoin.tsx`
- Create: `src/components/Roadmap.tsx`
- Create: `src/components/Manifesto.tsx`
- Create: `src/components/SiteFooter.tsx`
- Create: `src/components/PendingAction.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `Language`, `SiteCopy`, `siteContent`, and `projectConfig` from Task 1.
- Produces: each section component accepts `copy` for its own `SiteCopy` subsection; `SiteHeader` additionally accepts `language` and `onLanguageChange`.
- Produces: `PendingAction({ label, href, className, pendingLabel })` and prevents navigation when `href` is null.

- [ ] **Step 1: Replace the page tests with structural and safety expectations**

Add tests that assert:

```ts
expect(screen.getByRole('heading', { name: /蝴蝶股票/ })).toBeInTheDocument()
expect(screen.getByRole('region', { name: /蝴蝶效应/ })).toBeInTheDocument()
expect(screen.getByRole('region', { name: /Meme 信号终端/ })).toBeInTheDocument()
expect(screen.getByRole('region', { name: /蝴蝶股票四字内核/ })).toBeInTheDocument()
expect(screen.getByRole('region', { name: /预售控制台/ })).toBeInTheDocument()
expect(screen.getByRole('region', { name: /参与方式/ })).toBeInTheDocument()
expect(screen.getByRole('region', { name: /路线图/ })).toBeInTheDocument()
expect(screen.getByRole('region', { name: /社区宣言/ })).toBeInTheDocument()
expect(screen.getAllByText(/非金融数据/).length).toBeGreaterThan(0)
expect(screen.getByRole('button', { name: /预售尚未开放/ })).toBeDisabled()
```

Also switch to English and assert the section headings, presale rules, warning, and footer disclaimer become English.

- [ ] **Step 2: Run the App test and verify it fails**

Run: `npm test -- --run src/App.test.tsx`

Expected: FAIL because the new regions do not exist.

- [ ] **Step 3: Extract PendingAction and implement safe availability logic**

```tsx
export function PendingAction({ label, href, className = '', pendingLabel }: Props) {
  if (href) return <a className={`button ${className}`.trim()} href={href}>{label}</a>
  return <button className={`button ${className}`.trim()} disabled type="button" aria-label={pendingLabel}>{label}<span>{pendingLabel}</span></button>
}
```

- [ ] **Step 4: Implement Header, Hero, and TickerStrip**

Use semantic navigation to `#story`, `#signal`, `#presale`, and `#roadmap`. Hero must show the supplied Logo, brand names, the localized primary CTA, and a disabled presale CTA. TickerStrip only uses confirmed strings: `$FLAP`, `BSC`, `0.05 BNB`, `10,000 SEATS`, and `BUTTERFLY EFFECT`.

- [ ] **Step 5: Implement ButterflyEffect, SignalTerminal, and NameCore**

Render the exact arrays from `siteContent`. Signal metrics are decorative and always render the localized disclaimer adjacent to the values. NameCore renders four cards in order: 蝴, 蝶, 股, 票.

- [ ] **Step 6: Implement PresaleConsole and HowToJoin**

PresaleConsole derives availability as:

```ts
const presaleEnabled = Boolean(projectConfig.presale.contractAddress && projectConfig.presale.purchaseUrl)
```

When false, show all confirmed rules and a disabled action. Do not render an active link to `recipientAddress` and do not create wallet transaction logic.

- [ ] **Step 7: Implement Roadmap, Manifesto, and Footer**

Render only the three confirmed narrative phases and the localized risk statement. Do not add partners, price targets, exchange names, or launch claims.

- [ ] **Step 8: Compose App and synchronize document language**

`App` owns `language`, resolves `const copy = siteContent[language]`, updates `document.documentElement.lang`, and renders each component once in the ten-section order from the spec.

- [ ] **Step 9: Run tests**

Run: `npm test -- --run`

Expected: all tests pass.

- [ ] **Step 10: Commit Task 2**

```bash
git add src/App.tsx src/App.test.tsx src/components
git commit -m "feat: build full FLAP STOCK narrative experience"
```

---

### Task 3: Black-gold future visual system and lightweight motion

**Files:**
- Modify: `src/styles.css`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: stable component class names from Task 2.
- Produces: shared tokens, panel styles, responsive grids, animations, and reduced-motion overrides.

- [ ] **Step 1: Add visual contract assertions**

Read `src/styles.css` in the test and assert it contains:

```ts
expect(css).toContain('--gold: #f3ba2f')
expect(css).toContain('@keyframes wingPulse')
expect(css).toContain('@keyframes tickerFlow')
expect(css).toContain('@media (prefers-reduced-motion: reduce)')
```

- [ ] **Step 2: Run the visual contract test and verify it fails**

Run: `npm test -- --run src/App.test.tsx`

Expected: FAIL because the new token and animation names are absent.

- [ ] **Step 3: Implement global tokens and backgrounds**

Define `--void`, `--panel`, `--gold`, `--gold-bright`, `--cyan`, `--violet`, `--text`, `--muted`, `--line`, and `--max-width`. Layer a black radial glow, precision grid, scanlines, and subtle noise-like CSS gradients without remote assets.

- [ ] **Step 4: Style the desktop composition**

Create a wide asymmetric hero, luminous Logo chamber, glass-like terminal panels, oversized Chinese typography, four-card name grid, three-step effect grid, metric terminal, presale dashboard, vertical roadmap, and full-width manifesto. Keep primary body text at 16px or larger.

- [ ] **Step 5: Add lightweight motion**

Implement `wingPulse`, `tickerFlow`, `signalBlink`, `scanMove`, and `orbFloat`. Animate only transform, opacity, and background-position. Keep durations between 2 and 24 seconds and avoid continuous layout-changing properties.

- [ ] **Step 6: Add reduced-motion behavior**

Inside the reduced-motion media query, set animation duration to `.01ms`, animation iteration count to `1`, scroll behavior to `auto`, and transition duration to `.01ms` for all elements and pseudo-elements.

- [ ] **Step 7: Run tests and production build**

Run: `npm test -- --run && npm run build`

Expected: all tests pass and Vite completes the production build.

- [ ] **Step 8: Commit Task 3**

```bash
git add src/styles.css src/App.test.tsx
git commit -m "feat: add black gold future visual system"
```

---

### Task 4: Responsive parity and accessibility verification

**Files:**
- Modify: `src/styles.css`
- Modify: `src/App.test.tsx`
- Modify: `index.html`

**Interfaces:**
- Consumes: complete page from Tasks 1–3.
- Produces: tablet and mobile layouts with desktop-equivalent content, accessible labels, and no overflow.

- [ ] **Step 1: Add accessibility and language tests**

Test that every section has a named region, decorative graphics are hidden from accessibility APIs, the language button is labeled, and switching language changes `document.documentElement.lang` from `zh-CN` to `en`.

- [ ] **Step 2: Run tests and verify any missing semantics fail**

Run: `npm test -- --run src/App.test.tsx`

Expected: FAIL only for missing semantic attributes discovered by the new assertions.

- [ ] **Step 3: Implement tablet breakpoint**

At `max-width: 1024px`, change four-column grids to two columns, reduce hero title size, hide nonessential hero ornaments, and keep navigation usable.

- [ ] **Step 4: Implement mobile breakpoint**

At `max-width: 760px`, use single-column sections, full-width CTA buttons, a compact wrapping header, 44px controls, reduced padding, smaller Logo chamber, wrapping addresses, and simplified background effects.

- [ ] **Step 5: Implement narrow-phone breakpoint**

At `max-width: 360px`, reduce container gutters to 12px per side, prevent ticker and metric overflow, and keep all controls within viewport width.

- [ ] **Step 6: Complete metadata**

Keep the viewport declaration and add a concise bilingual meta description describing FLAP STOCK as a community Meme project. Do not add financial claims.

- [ ] **Step 7: Run all verification commands**

Run: `npm test -- --run && npm run build && git diff --check`

Expected: all tests pass, build succeeds, and `git diff --check` returns no errors.

- [ ] **Step 8: Commit Task 4**

```bash
git add src/styles.css src/App.test.tsx index.html
git commit -m "fix: complete responsive and accessible site parity"
```

---

### Task 5: Final safety review and Vercel production update

**Files:**
- Verify: `src/config/project.ts`
- Verify: `src/content/siteContent.ts`
- Verify: `src/components/PresaleConsole.tsx`
- Verify: `dist/**`

**Interfaces:**
- Consumes: validated production build.
- Produces: updated deployment at `https://flap-stock-meme.vercel.app`.

- [ ] **Step 1: Verify presale remains non-transactional**

Run:

```bash
rg -n "sendTransaction|writeContract|eth_sendTransaction|window\.ethereum\.request" src
```

Expected: no matches.

- [ ] **Step 2: Verify no fake market or participation claims**

Run:

```bash
rg -n "price|volume|raised|participants|收益|稳赚|保本|必涨" src
```

Expected: only neutral configuration, warnings, or test descriptions; no fake numeric claims or promises.

- [ ] **Step 3: Run final test and build gate**

Run: `npm test -- --run && npm run build && git status --short`

Expected: tests and build pass; only the user-supplied `upload/` directory may remain untracked.

- [ ] **Step 4: Deploy the exact `dist` output to the existing Vercel project**

Deploy to project `flap-stock-meme` with production target. Do not create or modify any BNBX or 70X project.

- [ ] **Step 5: Verify deployment readiness and public response**

Confirm Vercel reports `READY`, the alias is `flap-stock-meme.vercel.app`, and an HTTP HEAD request returns `200 OK`.

- [ ] **Step 6: Report the unchanged public URL**

Return `https://flap-stock-meme.vercel.app` and state that presale remains disabled until the verified contract address is configured.

