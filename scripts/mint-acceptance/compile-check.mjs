// Reproducible offline compilation; no RPC or wallet. Source unit matches the original verified build.
import solc from 'solc';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import * as C from './config.mjs';
export function checkCompilation() {
  assert.ok(solc.version().startsWith('0.8.24+'));
  const input = { language: 'Solidity', sources: { 'src/ButterflyMint.sol': { content: readFileSync(new URL('./contracts/ButterflyMint.sol', import.meta.url), 'utf8') } }, settings: {
    optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris', metadata: { bytecodeHash: 'ipfs' },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode'] } },
  } };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  assert.equal(output.errors?.filter(e => e.severity === 'error').length || 0, 0);
  for (const [kind, name, abi] of [['factory', 'ButterflyMintFactory', C.factoryAbi], ['implementation', 'ButterflyMintCampaign', C.campaignAbi]]) {
    const compiled = output.contracts['src/ButterflyMint.sol'][name];
    assert.equal('0x' + compiled.evm.deployedBytecode.object, C.deployment[kind].template);
    const offsets = Object.values(compiled.evm.deployedBytecode.immutableReferences).flat().map(r => r.start).sort((a, b) => a - b);
    assert.deepEqual(offsets, C.deployment[kind].references.map(r => r.start).sort((a, b) => a - b));
    // Foundry and solc order ABI items differently; their content must agree.
    const canonical = x => Array.isArray(x) ? x.map(canonical) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).filter(k => k !== 'internalType').sort().map(k => [k, canonical(x[k])])) : x;
    const normalize = x => JSON.stringify(canonical(x));
    assert.deepEqual(compiled.abi.map(normalize).sort(), abi.map(normalize).sort());
    if (kind === 'factory') assert.equal('0x' + compiled.evm.bytecode.object, C.deployment.bytecode);
  }
}
