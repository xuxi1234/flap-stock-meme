import {describe,it,expect} from 'vitest';
import {parseBNB,formatBNB,splitFee,MINT_WEI} from './model';
import {validateDeployment} from './chain';
import deployment from './deployment.json';
describe('NFT live payment rules',()=>{
 it('forwards exact 0.15777 BNB to seller with zero platform fee',()=>{const amount=parseBNB('0.15777');expect(splitFee(amount)).toEqual({fee:0n,seller:157770000000000000n});expect(formatBNB(amount)).toBe('0.15777');expect(MINT_WEI).toBe(parseBNB('0.01'));});
 it('preserves single wei precision and rejects invalid amounts',()=>{const value=parseBNB('0.010000000000000001');expect(formatBNB(value)).toBe('0.010000000000000001');for(const bad of ['0','-1','NaN','1e-2','0x10','0.0000000000000000001'])expect(()=>parseBNB(bad)).toThrow();});
 it('cannot activate without valid chain, addresses, code hashes and asset host',()=>{expect(()=>validateDeployment({...deployment,enabled:false})).toThrow();expect(()=>validateDeployment({...deployment,enabled:true})).toThrow();const valid={enabled:true,chainId:56,collection:'0x1111111111111111111111111111111111111111',market:'0x2222222222222222222222222222222222222222',collectionCodeHash:'0x'+'1'.repeat(64),marketCodeHash:'0x'+'2'.repeat(64),assetBase:'https://example.org/nft'};expect(validateDeployment(valid)).toEqual(valid);for(const extra of [{chainId:97},{collection:valid.market},{market:'0x0000000000000000000000000000000000000000'},{collectionCodeHash:''},{assetBase:'http://localhost/nft'}])expect(()=>validateDeployment({...valid,...extra})).toThrow();});
});
