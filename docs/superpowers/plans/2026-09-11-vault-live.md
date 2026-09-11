# Vault Live Implementation Plan

> Inline execution using superpowers:executing-plans; no subagents requested.

**Goal:** Replace simulated vault operations with real wallet and Flap contract integration.
**Architecture:** React routes retain the existing catalog and consume canonical ABI schemas using viem. Read-only API relays provide chain state; signing stays in the user's wallet.
**Tech Stack:** Existing React, TypeScript, viem, Vitest, Vercel.
**Spec:** ../specs/2026-09-11-vault-live.md

## Global constraints
- BSC chain ID 56; project owner and platform revenue 0x79F8b832DE72e81Ad34fd66EcbbF673613264072.
- Maximum operator budget 0.1 BNB. No production deployment and no secret handling.
- External factory owner/author fees must not be represented as changed.

## Tasks
- [ ] Add `src/vault/protocol.ts` for canonical launch/schema ABI and strict parameter encoding; cover scaled integers, array tuples, invalid addresses, excessive decimals and tax allocation with `src/vault/protocol.test.ts`.
- [ ] Add `src/vault/service.ts` for factory state, transaction preparation, bounded costs and receipt validation; require identity rechecks and persist pending hashes before polling.
- [ ] Add `src/vault/VaultPage.tsx` and scoped styles for live launch, wallet selection, metadata, fee review, factory policies and existing-vault operations; route catalog links to this page.
- [ ] Replace sample monitoring with chain-backed queries, remove demo wallet actions and simulated success states.
- [ ] Verify live BSC schemas and simulate a zero-buy launch; run TypeScript, targeted tests and build, inspect desktop/mobile and publish only the preview branch.
- [ ] Record unresolved source verification or signing prerequisites precisely; never describe unsigned transactions as completed deployments.
