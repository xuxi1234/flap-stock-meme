import solc from 'solc';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function compile(extra={}) {
 const sources={'ChangeFairies.sol':{content:fs.readFileSync(path.join(root,'contracts/ChangeFairies.sol'),'utf8')},...extra};
 const input={language:'Solidity',sources,settings:{optimizer:{enabled:true,runs:200},evmVersion:'paris',outputSelection:{'*':{'':['ast'],'*':['abi','evm.bytecode.object','evm.deployedBytecode.object','evm.deployedBytecode.immutableReferences','metadata']}}}};
 const output=JSON.parse(solc.compile(JSON.stringify(input),{import:p=>{const contents=fs.readFileSync(path.join(root,p.startsWith('vendor/')?'contracts':'node_modules',p),'utf8');input.sources[p]={content:contents};return {contents};}}));
 const errors=(output.errors||[]).filter(e=>e.severity==='error');if(errors.length)throw Error(errors.map(e=>e.formattedMessage).join('\n'));
 return {input,output,artifact:output.contracts['ChangeFairies.sol'].ChangeFairies};
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {const {artifact,input}=compile();fs.mkdirSync(path.join(root,'build'),{recursive:true});fs.writeFileSync(path.join(root,'build/artifact.json'),JSON.stringify(artifact));fs.writeFileSync(path.join(root,'build/compiler-input.json'),JSON.stringify(input));console.log('Compiled',artifact.evm.bytecode.object.length/2,'bytes');}
