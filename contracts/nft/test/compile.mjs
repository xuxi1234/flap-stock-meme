import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';
export function compile() {
 const sources = {};
 for (const dir of ['src','test']) for (const file of fs.readdirSync(dir)) if(file.endsWith('.sol')) sources[`${dir}/${file}`] = {content:fs.readFileSync(`${dir}/${file}`,'utf8')};
 const output = JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources,settings:{optimizer:{enabled:true,runs:200},evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}}),{import:p=>{try{return {contents:fs.readFileSync(path.join('node_modules',p),'utf8')}}catch{return {error:`Missing ${p}`}}}}));
 const errors=(output.errors??[]).filter(e=>e.severity==='error');
 if(errors.length) throw new Error(errors.map(e=>e.formattedMessage).join('\n'));
 return output.contracts;
}
if(process.argv[1].endsWith('compile.mjs')) { const c=compile(); console.log(`Compiled ${Object.keys(c).length} Solidity sources with solc ${solc.version()}`); }
