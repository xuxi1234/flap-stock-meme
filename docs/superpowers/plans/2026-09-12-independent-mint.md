# Independent Mint implementation

1. Add canonical V6 interface, non-upgradeable campaign and factory contracts with frozen terms and refund protection.
2. Add Foundry tests for share accounting, deadline/cancel refunds, launch failures, minimum output, reentry, claims, dust and factory privileges.
3. Compile and check sizes; run existing and new contract tests. Preserve reproducible ABI/bytecode/settings and source.
4. Add a wallet-signed factory deployment entry after successful validation. Verify its actual deployment before enabling campaign creation.
5. Add campaign UI, then execute a separately reviewed small live lifecycle through user signatures. Do not claim mocks are mainnet acceptance.

Authorization: continuation of the user's existing request for a usable independent vault/Mint application; user explicitly handles signatures and returns hashes. No further broadcast authorized to the agent.
