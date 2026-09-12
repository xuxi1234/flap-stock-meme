import fs from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const solc = process.env.AIRDROP_SOLC_MODULE ? require(process.env.AIRDROP_SOLC_MODULE) : require('solc')
if (!solc.version().startsWith('0.8.24+')) throw Error('Requires solc 0.8.24')
const source = fs.readFileSync('contracts/src/ButterflyDistributor.sol', 'utf8')
const input = { language: 'Solidity', sources: { 'ButterflyDistributor.sol': { content: source } }, settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris', outputSelection: { '*': { '*': ['abi','evm.bytecode.object','evm.deployedBytecode.object'] } } } }
const output = JSON.parse(solc.compile(JSON.stringify(input)))
if (output.errors?.some(e=>e.severity==='error')) throw Error(output.errors.map(e=>e.formattedMessage).join('\n'))
const c = output.contracts['ButterflyDistributor.sol'].ButterflyDistributor
const artifact = { compiler:solc.version(), abi:c.abi, bytecode:'0x'+c.evm.bytecode.object, runtime:'0x'+c.evm.deployedBytecode.object }
const target = 'src/airdrop/distributor.json'
if (process.argv.includes('--check')) {
 if (JSON.stringify(JSON.parse(fs.readFileSync(target))) !== JSON.stringify(artifact)) throw Error('Artifact mismatch')
} else fs.writeFileSync(target, JSON.stringify(artifact,null,2)+'\n')
console.log('Distributor artifact verified; bytecode bytes:',c.evm.bytecode.object.length/2)
