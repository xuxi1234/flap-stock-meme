import {describe,it,expect} from 'vitest';
import {parseBNB,formatBNB,splitFee,MINT_WEI,mintQuote,validateReferrer,effectiveReferrer} from './model';
import {validateDeployment} from './chain';
import deployment from './deployment.json';
describe('NFT live payment rules',()=>{
 it('forwards exact 0.15777 BNB to seller with zero platform fee',()=>{const amount=parseBNB('0.15777');expect(splitFee(amount)).toEqual({fee:0n,seller:157770000000000000n});expect(formatBNB(amount)).toBe('0.15777');expect(MINT_WEI).toBe(parseBNB('0.01'));});
 it('preserves single wei precision and rejects invalid amounts',()=>{const value=parseBNB('0.010000000000000001');expect(formatBNB(value)).toBe('0.010000000000000001');for(const bad of ['0','-1','NaN','1e-2','0x10','0.0000000000000000001'])expect(()=>parseBNB(bad)).toThrow();});
 it('cannot activate without valid chain, addresses, code hashes and asset host',()=>{expect(()=>validateDeployment({...deployment,enabled:false})).toThrow();expect(()=>validateDeployment({...deployment,enabled:true})).toThrow();const valid={enabled:true,chainId:56,collection:'0x1111111111111111111111111111111111111111',market:'0x2222222222222222222222222222222222222222',collectionCodeHash:'0x'+'1'.repeat(64),marketCodeHash:'0x'+'2'.repeat(64),assetBase:'https://example.org/nft'};expect(validateDeployment(valid)).toEqual(valid);for(const extra of [{chainId:97},{collection:valid.market},{market:'0x0000000000000000000000000000000000000000'},{collectionCodeHash:''},{assetBase:'http://localhost/nft'}])expect(()=>validateDeployment({...valid,...extra})).toThrow();});
});


describe('batch quotes and binding authority',()=>{
 it('quotes exact five NFT split and rejects malformed quantities',()=>{expect(mintQuote('5')).toEqual({quantity:5,total:50000000000000000n,reward:10000000000000000n,treasury:40000000000000000n});for(const bad of ['',0,'1.5',21,'01',' 1','1e1'])expect(()=>mintQuote(bad)).toThrow()});
 it('rejects invalid, self, collection, zero and burn inviters and trusts stored binding',()=>{const account='0x1111111111111111111111111111111111111111',bound='0x2222222222222222222222222222222222222222',collection='0x3333333333333333333333333333333333333333';for(const bad of ['',account,collection,'0x0000000000000000000000000000000000000000','0x000000000000000000000000000000000000dEaD'])expect(()=>validateReferrer(bad,account,collection)).toThrow();expect(effectiveReferrer(bound,'wrong URL',account,collection)).toBe(bound)});
});
