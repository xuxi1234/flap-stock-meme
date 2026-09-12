// Offline-only chain model. No network client or private key is created here.
import { keccak256 } from 'viem';
import * as C from './config.mjs';
const codeFixture = C.json(new URL('./data/runtime-code.json', import.meta.url));
export const initial = () => ({ total: 0n, shares: 0n, claimed: 0n, launched: false, aborted: false, token: C.ACCOUNT, claimable: [0n, 0n], timestamp: 1789183300n });
export const row = (nonce, value = 0n, success = true, fee = 100n) => ({ nonce, valueWei: String(value), success, feeWei: String(fee), events: [] });
const hex = n => '0x' + BigInt(n).toString(16);
export function fakeClient(state = initial()) {
  const f = { chainId: 56, latest: 5, pending: 5, gasPrice: 50000000n, broadcasts: 0, state, receiptRows: new Map(), rpcError: false };
  f.getChainId = async () => f.chainId;
  f.getBlockNumber = async () => 112n;
  f.getBlock = async () => ({ number: 112n, hash: '0xabc', timestamp: state.timestamp });
  f.getCode = async ({ address }) => address === C.FACTORY ? codeFixture.find(x => x.id === 'factoryCode').result : address === C.IMPLEMENTATION ? codeFixture.find(x => x.id === 'implementationCode').result : address === C.CAMPAIGN ? '0x363d3d373d3d3d363d73' + C.IMPLEMENTATION.slice(2).toLowerCase() + '5af43d82803e903d91602b57fd5bf3' : undefined;
  f.readContract = async ({ functionName }) => ({ owner: C.ACCOUNT, commissionReceiver: C.ACCOUNT, vaultPortal: C.VAULT_PORTAL, implementation: C.IMPLEMENTATION, isCampaign: true, creator: C.ACCOUNT, factory: C.FACTORY, config: C.terms, totalShares: state.total, sharesOf: state.shares, claimedShares: state.claimed, launched: state.launched, aborted: state.aborted, token: state.token, claimable: state.claimable, balanceOf: state.tokenBalance || 0n })[functionName];
  f.getTransactionCount = async ({ blockTag }) => blockTag === 'pending' ? f.pending : f.latest;
  f.getBalance = async () => C.BUDGET;
  f.estimateGas = async () => 80000n;
  f.getGasPrice = async () => f.gasPrice;
  f.call = async () => ({ data: '0x' });
  f.sendRawTransaction = async ({ serializedTransaction }) => { f.broadcasts++; return keccak256(serializedTransaction); };
  f.request = async ({ method, params: [hash] }) => {
    if (f.rpcError) throw Error('HTTP failure containing hypothetical secret');
    const r = f.receiptRows.get(hash); if (!r) return null;
    if (method === 'eth_getTransactionByHash') return { hash, from: r.from || C.ACCOUNT, to: r.to || C.CAMPAIGN, input: r.data || '0x', value: hex(r.valueWei), gas: hex(r.gas || 100n), gasPrice: hex(r.gasPrice || BigInt(r.feeWei) / 10n), chainId: '0x38', nonce: hex(r.nonce), blockHash: '0xabc' };
    return { transactionHash: hash, blockHash: '0xabc', blockNumber: hex(100), status: r.success ? '0x1' : '0x0', gasUsed: hex(r.gasUsed || 10n), effectiveGasPrice: hex(BigInt(r.feeWei) / BigInt(r.gasUsed || 10n)), logs: r.logs || [] };
  };
  return f;
}
