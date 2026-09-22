import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compile as baseCompile,root} from '../scripts/compile.mjs';
export function compile(extra={}) {
 const {input,output}=baseCompile(Object.fromEntries(['MoonCollection.sol','MoonMarket.sol'].map(n=>[n,{content:fs.readFileSync(path.join(root,'contracts',n),'utf8')}]).concat(Object.entries(extra))));
 return {input,output,collection:output.contracts['MoonCollection.sol'].MoonCollection,market:output.contracts['MoonMarket.sol'].MoonMarket};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const r=compile();fs.mkdirSync(path.join(root,'build/dual'),{recursive:true});
 for(const k of ['input','collection','market'])fs.writeFileSync(path.join(root,`build/dual/${k}.json`),JSON.stringify(r[k]));
 console.log('Compiled collection and market',r.collection.evm.bytecode.object.length/2,r.market.evm.bytecode.object.length/2);
}
