import {act,cleanup,fireEvent,render,screen} from '@testing-library/react'
import {afterEach,beforeAll,it,expect,vi} from 'vitest'
import {SwapPage} from './SwapPage'
import {getQuote,type SwapQuote} from './service'
import {TOKENS,BUTTERFLY} from './config'
vi.mock('./service',async original=>({...await original<typeof import('./service')>(),makeSwapClient:()=>({}),getQuote:vi.fn()}))
vi.mock('./useDiscovery',()=>({useFavorites:()=>({favorites:[],toggle:()=>{},storageError:false}),useMarketSnapshot:()=>({snapshot:null,loading:false,error:false,refresh:()=>{}})}))
vi.mock('../web3/walletProviders',()=>({discoverWalletProviders:()=>()=>{}}))
// JSDOM has no native dialog methods; model open/close for accessible UI tests.
beforeAll(()=>{
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')}
 HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')}
})
afterEach(()=>{cleanup();vi.useRealTimers();vi.clearAllMocks();window.history.replaceState({}, '', '/')})
it('keeps a slow quote alive across the automatic refresh interval',async()=>{
 vi.useFakeTimers();let resolve!:(quote:SwapQuote)=>void
 vi.mocked(getQuote).mockImplementation(()=>new Promise(r=>{resolve=r}))
 render(<SwapPage/>);fireEvent.change(screen.getByRole('textbox',{name:'你支付'}),{target:{value:'1'}})
 await act(async()=>{await vi.advanceTimersByTimeAsync(401)})
 await act(async()=>{await vi.advanceTimersByTimeAsync(21000)})
 expect(getQuote).toHaveBeenCalledTimes(1)
 await act(async()=>{resolve({input:TOKENS[0],output:BUTTERFLY,amountIn:10n**18n,amountOut:7n*10n**18n,path:[TOKENS[0].address,BUTTERFLY.address],block:1n,impactBps:0,wrap:false,expiresAt:Date.now()+30000})})
 expect(screen.getByRole('status',{name:'预计收到数量'})).toHaveTextContent('6.944')
})

it('changes automatic slippage with the pair and preserves an explicit manual override',()=>{
 window.history.replaceState({}, '', '/')
 render(<SwapPage/>)
 expect(screen.getByRole('button',{name:'自动 · 4.0% 调整'})).toBeInTheDocument()
 fireEvent.click(screen.getByRole('button',{name:'选择接收代币，当前 蝴蝶股票'}))
 fireEvent.click(screen.getByRole('button',{name:/^USDT Binance-Peg/}))
 expect(screen.getByRole('button',{name:'自动 · 0.5% 调整'})).toBeInTheDocument()
 fireEvent.click(screen.getByRole('button',{name:'兑换设置'}))
 expect(screen.getByRole('button',{name:'自动'})).toHaveAttribute('aria-pressed','true')
 fireEvent.click(screen.getByRole('button',{name:'1%'}))
 fireEvent.click(screen.getByRole('button',{name:'完成设置'}))
 fireEvent.click(screen.getByRole('button',{name:'选择接收代币，当前 USDT'}))
 fireEvent.click(screen.getByRole('button',{name:/^蝴蝶股票 蝴蝶股票/}))
 expect(screen.getByRole('button',{name:'1.0% 调整'})).toBeInTheDocument()
 fireEvent.click(screen.getByRole('button',{name:'兑换设置'}))
 fireEvent.change(screen.getByRole('textbox',{name:'自定义滑点百分比'}),{target:{value:'2.5'}})
 expect(screen.getByText('当前生效：2.5% · 支持 0.1%–5%')).toBeInTheDocument()
 fireEvent.click(screen.getByRole('button',{name:'自动'}))
 expect(screen.getByRole('textbox',{name:'自定义滑点百分比'})).toHaveValue('')
 fireEvent.click(screen.getByRole('button',{name:'完成设置'}))
 expect(screen.getByRole('button',{name:'自动 · 4.0% 调整'})).toBeInTheDocument()
 window.history.replaceState({}, '', '/')
})

it('uses the automatic tolerance in minimum received and updates it when overridden',async()=>{
 window.history.replaceState({}, '', '/')
 vi.useFakeTimers()
 vi.mocked(getQuote).mockResolvedValue({input:TOKENS[0],output:BUTTERFLY,amountIn:10n**18n,amountOut:7n*10n**18n,path:[TOKENS[0].address,BUTTERFLY.address],block:1n,impactBps:0,wrap:false,expiresAt:Date.now()+30000})
 render(<SwapPage/>)
 expect(screen.getByRole('button',{name:'自动 · 4.0% 调整'})).toBeInTheDocument()
 fireEvent.change(screen.getByRole('textbox',{name:'你支付'}),{target:{value:'1'}})
 await act(async()=>{await vi.advanceTimersByTimeAsync(401)})
 // 7 minus the 0.8% platform fee = 6.944; 4% tolerance leaves 6.66624.
 expect(screen.getByText('最低收到').parentElement).toHaveTextContent('6.66624 蝴蝶股票')
 fireEvent.click(screen.getByRole('button',{name:'兑换设置'}))
 fireEvent.click(screen.getByRole('button',{name:'1%'}))
 fireEvent.click(screen.getByRole('button',{name:'完成设置'}))
 expect(screen.getByText('最低收到').parentElement).toHaveTextContent('6.87456 蝴蝶股票')
})
