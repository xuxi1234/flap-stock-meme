# 蝴蝶股票 Meme Website and Presale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, verify, and independently publish the 蝴蝶股票 (FLAP STOCK) Meme website with a fixed-price BSC presale contract.

**Architecture:** A Vite React static frontend reads a single typed configuration module and interacts with an immutable Solidity presale contract through viem. A Foundry contract package owns all on-chain enforcement; the website remains functional as a Meme landing page before a verified contract address is configured.

**Tech Stack:** React 19, TypeScript, Vite, CSS, viem, Vitest, Testing Library, Playwright, Solidity 0.8.30, Foundry, OpenZeppelin Contracts 5.x, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-02-flap-stock-meme-design.md`

## Global Constraints

- Official token name is `蝴蝶股票`, English name is `FLAP STOCK`, and symbol is `FLAP`.
- BSC mainnet chainId is `56`; presale payment is exactly `0.05 BNB` once per address.
- Maximum participation is `10,000` addresses; initial end timestamp is `1788969599`.
- Admin is `0xbE37AB912De351B9312FA593C9f99e3279FDB0a2`.
- Treasury is immutable at `0x59389BDb944a4d8D4747b373b665a781d8DCD420`.
- Admin may pause, resume, and change the end timestamp, but may not change price, capacity, or treasury.
- No automatic FLAP distribution, no refunds, no fabricated market data, and no return promises.
- GitHub and Vercel projects must both be named `flap-stock-meme` and isolated from BNBX and 70X.

---

### Task 1: Contract behavior and invariant tests

**Files:**
- Create: `contracts/src/FlapPresale.sol`
- Create: `contracts/test/FlapPresale.t.sol`
- Create: `contracts/foundry.toml`

**Interfaces:**
- Produces: `FlapPresale.participate() payable`, `hasParticipated(address)`, `participantCount()`, `endTime()`, `paused()`, `setEndTime(uint64)`, `pause()`, `unpause()`.

- [ ] Write Foundry tests for deployment constants, exact payment, duplicate rejection, capacity, deadline, pause, admin authorization, treasury forwarding, forwarding failure, and reentrancy.
- [ ] Run `forge test` and confirm the suite fails before the contract exists.
- [ ] Implement the minimal immutable-price contract with custom errors, checks-effects-interactions, `ReentrancyGuard`, `Pausable`, and `Ownable`.
- [ ] Run `forge fmt --check && forge test -vvv` and require all tests to pass.
- [ ] Commit contract and tests with `feat: add fixed-price FLAP presale contract`.

### Task 2: Frontend foundation and brand system

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`
- Create: `src/main.tsx`, `src/App.tsx`, `src/styles.css`
- Create: `src/config/project.ts`, `src/test/setup.ts`, `src/App.test.tsx`
- Copy: `public/flap-stock-logo.png` from the supplied image

**Interfaces:**
- Produces: `projectConfig` containing immutable brand values and nullable token/presale/community links.

- [ ] Write component tests asserting the official names, symbol, disclaimer, and COMING SOON states.
- [ ] Run `npm test -- --run` and confirm failure before implementation.
- [ ] Build the responsive black-and-gold shell, typography, navigation, hero, buttons, and accessible focus states.
- [ ] Run unit tests and `npm run build`; require both to pass.
- [ ] Commit with `feat: establish FLAP STOCK brand experience`.

### Task 3: Meme content and lightweight motion

**Files:**
- Create: `src/components/ButterflyEffect.tsx`, `MemeTerminal.tsx`, `MemeGallery.tsx`, `Roadmap.tsx`, `TokenPaper.tsx`
- Create: `src/components/content.test.tsx`
- Modify: `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `projectConfig` from Task 2.
- Produces: semantic section anchors `story`, `memes`, `token`, and `roadmap`.

- [ ] Write tests for entertainment-only metrics, three-phase roadmap, token data fallbacks, and disclaimer text.
- [ ] Implement the approved Chinese-first Meme copy and reusable section components.
- [ ] Add CSS-only wing pulse, chart draw, hover glitch, and reduced-motion overrides.
- [ ] Run unit tests, build, and axe-oriented semantic checks.
- [ ] Commit with `feat: add butterfly effect meme storytelling`.

### Task 4: Wallet and presale experience

**Files:**
- Create: `src/web3/presaleAbi.ts`, `src/web3/presale.ts`, `src/components/Presale.tsx`
- Create: `src/web3/presale.test.ts`, `src/components/Presale.test.tsx`
- Modify: `src/config/project.ts`, `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Produces: `readPresaleState(client, contract, account?)`, `participate(walletClient, contract)`, and a UI that never sends when the contract address is null.

- [ ] Write tests for disabled state, wrong network, fixed 0.05 BNB value, already-participated state, countdown, sold-out state, RPC rejection, and rejected transactions.
- [ ] Implement BSC wallet detection, chain switching, reads, and fixed-value contract write using viem.
- [ ] Add explicit manual-distribution, no-refund, and one-address-not-one-person notices before confirmation.
- [ ] Run unit tests and production build.
- [ ] Commit with `feat: add guarded FLAP presale participation`.

### Task 5: Browser verification

**Files:**
- Create: `playwright.config.ts`, `e2e/site.spec.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: completed static frontend.
- Produces: repeatable desktop/mobile smoke suite.

- [ ] Add Playwright tests for 1440x900 and 390x844 viewports, navigation, COMING SOON presale safety, reduced motion, and horizontal overflow.
- [ ] Run `npm run test:e2e` and fix all reproducible failures.
- [ ] Capture desktop and mobile screenshots for visual review.
- [ ] Run `npm test -- --run && npm run build && npm run test:e2e` as the full frontend gate.
- [ ] Commit with `test: verify FLAP STOCK responsive experience`.

### Task 6: Contract deployment readiness

**Files:**
- Create: `contracts/script/DeployFlapPresale.s.sol`, `contracts/README.md`
- Create: `.env.example`

**Interfaces:**
- Produces: deterministic constructor arguments and documented BSC deployment/verification commands without storing credentials.

- [ ] Add a deployment script that checks chainId 56 and deploys with the exact admin, treasury, and timestamp.
- [ ] Add a script test or dry run confirming constructor arguments and ownership.
- [ ] Run all contract tests and generate size/gas reports.
- [ ] Document deployment, verification, admin actions, event export, and manual FLAP distribution workflow.
- [ ] Commit with `docs: add audited presale deployment workflow`.

### Task 7: Independent GitHub and Vercel publication

**Files:**
- Create: `README.md`, `.gitignore`, `vercel.json`
- Modify: `src/config/project.ts` only after a verified contract deployment exists.

**Interfaces:**
- Produces: public GitHub repository and public Vercel production URL named `flap-stock-meme`.

- [ ] Scan tracked files for secrets and forbidden BNBX/70X coupling.
- [ ] Create the independent GitHub repository and push the reviewed commit history.
- [ ] Create the independent Vercel project, deploy the static build, and record the production URL.
- [ ] Run HTTP and browser smoke tests against the production URL.
- [ ] If no verified mainnet contract exists, keep presale transaction controls disabled and show COMING SOON.
- [ ] Report repository URL, deployment URL, tests, contract readiness, and any remaining mainnet-only action.
