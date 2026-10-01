import {describe,it,expect} from 'vitest';
import {matchesNFT,type NFT} from './model';
import snapshot from '../../data/nft-companies.json';
describe('company themes',()=>{
 it('uses exactly 500 distinct companies with a frozen source',()=>{
  expect(snapshot.companies).toHaveLength(500);
  expect(new Set(snapshot.companies.map(c=>c.name)).size).toBe(500);
  expect(new Set(snapshot.companies.map(c=>c.ticker)).size).toBe(500);
  expect(snapshot.companies[499].ticker).toBe('LVS');
 });
 it('searches Chinese names, English legal names and case-insensitive tickers and respects series',()=>{
  const nft={id:501,name:'英伟达 · 蓝闪蝶 #0501',family:'蓝闪蝶',palette:'Morpho-inspired',theme:{kind:'company',name:'英伟达',legalName:'NVIDIA Corporation',ticker:'NVDA',edition:2,total:15,snapshot:snapshot.version}} as NFT;
  for(const q of ['英伟达','nvidia','nvda','蓝闪蝶','#501'])expect(matchesNFT(nft,q,'company')).toBe(true);
  expect(matchesNFT(nft,'NVDA','original')).toBe(false);
  expect(matchesNFT(nft,'apple','all')).toBe(false);
 });
});
