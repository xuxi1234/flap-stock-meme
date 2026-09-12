import { readFileSync } from 'node:fs';
export const json = url => JSON.parse(readFileSync(url, 'utf8'));
const artifact = json(new URL('../../src/vault/mint-artifacts.json', import.meta.url));
export const campaignAbi = artifact.campaignAbi;
export const factoryAbi = artifact.factoryAbi;
export const terms = json(new URL('../../docs/vault-live-evidence/mint-campaign-decoded.json', import.meta.url)).config;
export const ACCOUNT = '0x79F8b832DE72e81Ad34fd66EcbbF673613264072';
export const CAMPAIGN = '0xC7c1BcD4F0d25e04Ca3CA58139284B7E075B5eb1';
export const FACTORY = '0xA64186DB66bAed9fDC13678c4Cfb89B1e1E9cCa9';
export const IMPLEMENTATION = '0x904C9E436299A65Fc25f32c48F3f908534F0e988';
export const VAULT_PORTAL = '0x90497450f2a706f1951b5bdda52B4E5d16f34C06';
export const PORTAL = '0xe2cE6ab80874Fa9Fa2aAE65D277Dd6B8e65C9De0';
export const TAX_IMPL = '0x024f18294970B5c76c0691b87f138A0317156422';
export const BUDGET = 100000000000000000n; // 0.1 BNB, gross outgoing value + all gas since nonce 0.
export const SHARE_PRICE = 10000000000000000n;
export const GAS_CAP = 2000000000000000n; // 0.002 BNB maximum gas reservation per transaction.
export const CONFIRMATIONS = 12n;
export const FACTORY_CODE_HASH = '0x4b9871417e5c69abf1775b2e942648a9d79fa1127a313257428bda1d335539b3';
export const IMPLEMENTATION_CODE_HASH = '0x09cc19e13aadaeb0ca999308177a861534a64dbd3f7faf1375b01bd32926c900';
export const CHECKPOINTS = [
  '0x6e56ed60da568446c36cf2890f9a52ed1c93105a68a6bca6bc171bfc86c43c5f',
  '0x6e048b3aecb8c376162960bc0074f200a6dbab8810f0b3bbf6451144d032d7a2',
  '0x01a55b25cb4904f734b0f02f26c4d1e4a1ea716914d91db1096d32a2eca6111c',
  '0x7c2570e4ff063dc1c90f0d9524f0b2523b0c3b96317a9a39559abffb91ac06dd',
  '0x6e882e7a2609a4fec102948dcfbd08247355603fda66a0a9f11091d7cceaca5d',
];
