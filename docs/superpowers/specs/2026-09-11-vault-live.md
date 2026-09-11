# Vault live integration

The accepted goal is a usable Butterfly-branded vault application on a Vercel preview only. Existing production and presale contracts remain unchanged. The project administrator and platform revenue recipient are 0x79F8b832DE72e81Ad34fd66EcbbF673613264072. The operator's BNB execution budget is capped at 0.1 BNB. No private keys are required or stored.

Use Flap's canonical V6 tax-token launch interface, discovered factory schemas and quote compatibility policies. Show native BNB launch with zero initial purchase by default. External factory addresses remain explicitly third-party: frontend changes do not transfer factory ownership, and fixed factory author fees cannot be reassigned. Flap V3's commissionReceiver is the project revenue recipient; user distributions remain configured by the chosen template. Display these distinct roles before signatures.

Replace demo configuration and wallet with a React launch route using viem and EIP-6963. Read schema and balances through the existing bounded BSC read relay. Validate and ABI-encode actual factory parameters, upload metadata to Flap, mine the official 7777 CREATE2 salt, simulate the exact transaction, estimate gas, review and sign in the user's wallet. Reject stale reviews after edits, wallet/account/chain changes, missing code, simulation failures or budget overflow. No automated mainnet broadcast.

Read deployed vaults through VaultPortal.getVault, offer schema-driven contract queries and writes, exact token approvals only where the verified schema requires them, and record transaction hashes immediately. Missing schemas must produce an explicit unsupported state. Do not use snapshot data as live data or fabricate success. Mint factory ownership and deployment fees require separate source verification before creating Mint campaigns.

Validation: codec boundary tests, ABI round trips, wallet identity/rejection/receipt tests, live factory schema reads, exact launch simulation, TypeScript/build and responsive browser checks. A successful simulation is not a successful mainnet transaction; report that distinction.
