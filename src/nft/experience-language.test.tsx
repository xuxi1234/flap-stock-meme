import {render,screen,fireEvent,cleanup,within} from '@testing-library/react';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import NFTPage from './NFTPage';
import {drawExperience} from './components/FreeOpen';
import type {NFT} from './model';
const catalog=Array.from({length:20},(_,i)=>({id:i+1,name:`蝴蝶股票原创特别款 · 蓝闪蝶 #${i+1}`,nameEn:`Butterfly Originals · Morpho #${i+1}`,family:'蓝闪蝶',familyEn:'Morpho',palette:'Morpho-inspired',image:`/nft/art/${i+1}.jpg`,color:'#178bff',theme:{kind:'original',name:'蝴蝶股票原创特别款',nameEn:'Butterfly Originals',ticker:'FLAP STOCK',edition:i+1,total:277,snapshot:'fixed'}})) as NFT[];
beforeEach(()=>{localStorage.clear();history.replaceState(null,'','/');vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>catalog}));HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};Element.prototype.scrollIntoView=vi.fn()});
afterEach(()=>{cleanup();localStorage.clear();history.replaceState(null,'','/');vi.unstubAllGlobals()});
it('draws distinct IDs within each free batch and rejects invalid quantities',()=>{const result=drawExperience(catalog,20);expect(new Set(result.map(n=>n.id)).size).toBe(20);expect(catalog[0].id).toBe(1);for(const q of [0,21,1.2,NaN])expect(()=>drawExperience(catalog,q)).toThrow()});
it('switches language without losing canonical filters, and free results remain outside wallet holdings',async()=>{
 render(<NFTPage/>);await screen.findByRole('button',{name:'查看 蝴蝶股票原创特别款 · 蓝闪蝶 #1'});
 fireEvent.change(screen.getByRole('combobox',{name:'筛选蝶类'}),{target:{value:'蓝闪蝶'}});
 fireEvent.click(screen.getByRole('button',{name:'Language / 语言'}));
 expect(document.documentElement.lang).toBe('en');expect(screen.getByRole('combobox',{name:'Filter butterfly family'})).toHaveValue('蓝闪蝶');
 expect(screen.getAllByText('Butterfly Originals').length).toBeGreaterThan(0);
 fireEvent.click(screen.getByRole('button',{name:'Free reveal ↗'}));
 expect(screen.getByText('Free experience · Not an on-chain NFT')).toBeInTheDocument();
 fireEvent.change(screen.getByRole('textbox',{name:'Experience quantity'}),{target:{value:'5'}});
 fireEvent.click(screen.getByRole('button',{name:'Reveal randomly ↗'}));
 expect(screen.getByRole('region',{name:'Experience results'}).querySelectorAll('figure')).toHaveLength(5);
 expect(screen.getByRole('button',{name:'My collection0'})).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Close dialog'}));
 fireEvent.click(screen.getByRole('button',{name:'Language / 语言'}));
 expect(screen.getByRole('combobox',{name:'筛选蝶类'})).toHaveValue('蓝闪蝶');
});

it('saves free results to the wishlist without creating wallet holdings',async()=>{
 render(<NFTPage/>);await screen.findByRole('button',{name:'查看 蝴蝶股票原创特别款 · 蓝闪蝶 #1'});
 fireEvent.click(screen.getByRole('button',{name:'免费开蝶 ↗'}));fireEvent.click(screen.getByRole('button',{name:'随机开出 ↗'}));
 const results=screen.getByRole('region',{name:'体验结果'});const save=within(results).getByRole('button',{name:/加入心愿单/});fireEvent.click(save);
 expect(save).toHaveAttribute('aria-pressed','true');expect(JSON.parse(localStorage.getItem('butterfly-nft-favorites')!)).toHaveLength(1);
 expect(screen.getByRole('button',{name:'我的收藏0'})).toBeInTheDocument();fireEvent.click(save);expect(JSON.parse(localStorage.getItem('butterfly-nft-favorites')!)).toEqual([]);
});
