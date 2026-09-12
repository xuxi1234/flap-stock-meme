# Mint preview check — 2026-09-12

- Code commit: e4df7d89b045b76e98e78cd4d1927288e9ca0bac.
- Preview deployment: dpl_4KZhzQFSJ87RRwKNpifiba2zM9Zx, READY; target is preview.
- GitHub Contracts workflow run 34666854767 / job 103480387210 completed successfully: formatting, compilation, sizes, artifact equality and tests.
- Desktop page rendered Mint deployment form, exact deployment-data digest and fixed owner/commission receiver. The deployment button without a wallet shows a connection requirement. The connection button opens the real wallet-provider selection dialog.
- At 390px iframe viewport, body/cards/addresses wrap inside the mobile viewport and navigation scrolls horizontally.
- Cloud browser has no injected wallet. No fake provider was injected, no wallet transaction was submitted, and signed end-to-end mainnet acceptance remains pending user action.
- Read-only constructor simulation through the deployed relay returned HTTP 200, 2,257 runtime bytes, gas estimate 2,789,989. At the observed gas price, the padded allowance was approximately 0.00020925 BNB, below the 0.002 BNB handoff cap. Wallet-time simulation must recheck this.
- The exact code preview URL is flap-stock-meme-dcm3ebnkb-xuxis-projects-7df64997.vercel.app, route /?view=vault-live&panel=mint. Access shares expire; minting state itself is on-chain after deployment.
- Ordinary vault status page independently displayed live commission recipient 0x79F8b832DE72e81Ad34fd66EcbbF673613264072 matching the requested recipient. No new ordinary acceptance vault was created.
