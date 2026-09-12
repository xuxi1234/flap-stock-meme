// Run forge build --root contracts first. No keys, network or broadcasting.
import {readFileSync,writeFileSync} from 'node:fs';
const read=name=>JSON.parse(readFileSync(`contracts/out/ButterflyMint.sol/${name}.json`,'utf8'));
const factory=read('ButterflyMintFactory'),campaign=read('ButterflyMintCampaign');
const output=JSON.stringify({compiler:'0.8.24',optimizerRuns:200,evmVersion:'paris',factoryAbi:factory.abi,campaignAbi:campaign.abi,bytecode:factory.bytecode.object},null,2)+'\n';
if(process.argv.includes('--check')){if(readFileSync('src/vault/mint-artifacts.json','utf8')!==output)throw Error('Mint artifacts differ from compiled contracts');}else writeFileSync('src/vault/mint-artifacts.json',output);
