# Butterfly vault preview QA

final result: passed

## Comparison target and evidence

Reference: https://mxsj.space/ captured on 2026-09-11. Implementation: the isolated `/vault/index.html` document, reached from the new `/?view=vault` homepage navigation entry.

Source and implementation are paired in the same comparison images (reference left, implementation right):
- `docs/vault-preview-qa/desktop.jpg`: full desktop view.
- `docs/vault-preview-qa/mobile.jpg`: 390 × 844 mobile iframe view.
- `docs/vault-preview-qa/cards.jpg`: focused builder card, statistics and template typography comparison.

Original captures: `/workspace/scratch/2e3d5021c087/vault-reference/source-desktop.jpg`, `source-mobile.jpg`, `preview-desktop-final.jpg`, `preview-mobile-final.jpg`. The paired evidence above preserves both sides in this repository.

Desktop browser CSS viewport reports 1363 × 936; the browser screenshot API emitted 1348 × 926 for both source and implementation. Both captures use identical dimensions and were joined without rescaling. Mobile source and implementation are 390 × 844 CSS/frame pixels and 390 × 844 image pixels; no density normalization needed. States: Chinese, default dark theme, announcement dismissed, top of home page.

## Comparison history

1. P2: desktop content started 8 px higher than the reference. Restored the reference body margin.
2. P1: the adapted mobile header wrapped its actions into a fourth row and obscured the heading. Kept the actions on one horizontally scrollable row and removed the scrollbar's reserved height. Retested the 390 px frame.
3. P2: four reference images were unavailable through the reference proxy. Captured the actual fallback source images and stored local WebP derivatives; all 31 template covers now reference local files. Six large tutorial images were also optimized.
4. P2: a font-subsetting expression removed the Latin faces. Restored 15 matching Latin faces as embedded font resources before the final capture.
5. Re-captured both implementations and inspected the three final paired images above. No actionable P0/P1/P2 findings remain for the preview scope.

## Required fidelity surfaces

- Typography: reference font faces retained, Chinese fallback and headline/card hierarchy checked in desktop and mobile comparisons.
- Spacing/layout: hero, builder panel, grids, button sizes, borders, radii and mobile stacking follow the source. No document-level horizontal overflow on desktop. Mobile navigation remains reachable by horizontal scrolling.
- Colors/tokens: source black/gold palette, gradients and subdued text colors preserved.
- Images: real reference assets used; no invented icons or illustrations. Four images are crops of the original image-only browser view, resized to card-appropriate WebP. Butterfly branding intentionally replaces the source author's avatar.
- Copy/content: template descriptions and fill instructions reference the source. Own branding, preview labels and zero preview deployments intentionally replace source identity and live deployment totals. Live sample lists are explicitly dated snapshots, not live quotes.

## Interactions verified in the cloud browser

- Homepage desktop navigation contains 金库 between 蝴蝶swap and 参与私募.
- Template category filter, stock category + keyword combination, and empty search state.
- Desktop form: name/symbol entry, parameter locking, configuration review.
- Mobile form at 390 px: name/symbol entry, parameter locking, configuration review.
- Source and implementation announcement dismissal and image/detail affordances were inspected.
- Browser error log inspected: only the browser extension's metadata transport messages were present, not application exceptions.
- TypeScript check and Vite build passed. JavaScript syntax check passed.

## Intentional preview boundaries

This is a branded frontend adaptation of the source catalog and its configuration workflow, not the source's smart-contract backend. Wallet actions are explicitly simulated. Configuration export is a draft, not deployable calldata. Source contracts have not been audited by this project. Market/monitor data are labeled samples. The source's English translation, live monitoring service and on-chain deployment integrations are not reproduced in this preview; the language control is replaced by a preview-information control.

The work is confined to a preview branch. No production aliases, DNS, or main-branch updates are part of this change.
