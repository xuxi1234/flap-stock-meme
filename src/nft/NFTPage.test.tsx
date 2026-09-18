import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import NFTPage from './NFTPage';
const item={id:1,name:'蓝闪蝶 #0001',family:'蓝闪蝶',palette:'Morpho-inspired',color:'#178bff',rarity:'典藏',wing:'round',pattern:'veins',halo:'自然光',dna:'a'.repeat(64),image:'/nft/art/1.jpg'};
beforeEach(()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>[item]}));HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};Element.prototype.scrollIntoView=vi.fn();});
afterEach(()=>{cleanup();vi.unstubAllGlobals()});
describe('NFT public payment gates',()=>{
 it('shows actual collection while mint payment stays disabled without deployment',async()=>{render(<NFTPage/>);await screen.findByRole('button',{name:'查看 蓝闪蝶 #0001'});fireEvent.click(screen.getByRole('button',{name:'随机批量铸造 ↗'}));expect(screen.getByRole('button',{name:'尚未开放付款'})).toBeDisabled();expect(screen.getAllByText('暂不可用')).toHaveLength(4);expect(screen.queryByText(/免费模拟|体验购买/)).not.toBeInTheDocument();});
 it('contains no fabricated market orders',async()=>{render(<NFTPage/>);await screen.findByRole('button',{name:'查看 蓝闪蝶 #0001'});fireEvent.click(screen.getByRole('button',{name:'交易市场0'}));expect(screen.queryByRole('button',{name:'购买 ↗'})).not.toBeInTheDocument();expect(screen.getByText('这里仅展示链上挂单，没有演示订单。')).toBeInTheDocument();});
 it('shows wallet errors inside the open dialog',async()=>{render(<NFTPage/>);fireEvent.click(screen.getByRole('button',{name:'连接钱包 ↗'}));const dialog=screen.getByRole('dialog');fireEvent.click(dialog.querySelector('.nft-btn')!);await waitFor(()=>expect(dialog.textContent).toContain('请在 TokenPocket 的 DApp 浏览器打开本站'));});
});

