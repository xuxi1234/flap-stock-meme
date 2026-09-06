# FLAP STOCK Participation Center V2 — Design QA

## Reference and target

- Reference: current production capture at desktop width, preserving the supplied acid-lime/purple avatar, heavy typography, outlined cards, and animated butterfly identity.
- Target: the user-approved participation-center brief, which prioritizes rules, transaction completion, result lookup, public proof, and mobile use over additional decorative sections.

## Visual comparison

- Brand fidelity: passed. The real `flap-stock-avatar.png`, acid lime, saturated purple, black outlines, rounded hard-shadow cards, and display typography remain consistent with the existing identity.
- Information hierarchy: passed. Confirmed conditions and unknown terms precede the participation center; story content now follows the conversion and verification path.
- Desktop composition: passed at the cloud-browser viewport. Hero, rules, participation dashboard, proof, updates, four-character core, and FAQ form one consistent page system.
- Mobile composition: passed at 375px and 320px iframe viewports in the cloud browser. No horizontal overflow was observed; all visible actionable targets measured at least 44px.
- Mobile butterfly: passed. The real brand avatar remains visible after the three key participation facts and uses the `mobileWingFlap` animation.

## Interaction QA

- Chinese/English toggle: passed in the cloud browser.
- Wallet chooser: passed. With no injected provider, the modal opens and provides mobile wallet-browser guidance while clearly stating QR connection is not configured.
- Project address copy: passed; control changed to the copied state.
- BscScan target: passed; presale contract link resolved to `https://bscscan.com/address/0x409c9448172b0f244a6823e91ad669281294622b`.
- Transaction state behavior: passed in automated tests for broadcast hash visibility, confirmation, wallet rejection, and receipt-query uncertainty.
- Console: no application-origin errors observed. Cloud-browser extension metadata errors were excluded as unrelated to the site.

## Automated checks

- Vitest: 33 tests passed.
- TypeScript and Vite production build: passed.
- `git diff --check`: passed.
- The standalone Playwright CLI responsive script could not launch because this workspace lacks a Playwright browser binary. Required visual and responsive checks were completed through the connected cloud browser instead.

## Remaining P3 polish

- Replace the square Open Graph avatar with a dedicated 1200 × 630 campaign card when an approved social-card asset is available.
- Add WalletConnect QR only after a project-owned WalletConnect Project ID is configured.

final result: passed
