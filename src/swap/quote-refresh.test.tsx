import {act,cleanup,fireEvent,render,screen} from '@testing-library/react'
import {afterEach,it,expect,vi} from 'vitest'
import {SwapPage} from './SwapPage'
import {getQuote,type SwapQuote} from './service'
import {TOKENS,BUTTERFLY} from './config'
vi.mock('./service',async original=>({...await original<typeof import('./service')>(),makeSwapClient:()=>({}),getQuote:vi.fn()}))
vi.mock('./useDiscovery',()=>({useFavorites:()=>({favorites:[],toggle:()=>{},storageError:false}),useMarketSnapshot:()=>({snapshot:null,loading:false,error:false,refresh:()=>{}})}))
vi.mock('../web3/walletProviders',()=>({discoverWalletProviders:()=>()=>{}}))
afterEach(()=>{cleanup();vi.useRealTimers();vi.clearAllMocks()})
it('keeps a slow quote alive across the automatic refresh interval',async()=>{
 vi.useFakeTimers();let resolve!:(quote:SwapQuote)=>void
 vi.mocked(getQuote).mockImplementation(()=>new Promise(r=>{resolve=r}))
 render(<SwapPage/>);fireEvent.change(screen.getByRole('textbox',{name:'你支付'}),{target:{value:'1'}})
 await act(async()=>{await vi.advanceTimersByTimeAsync(401)})
 await act(async()=>{await vi.advanceTimersByTimeAsync(21000)})
 expect(getQuote).toHaveBeenCalledTimes(1)
 await act(async()=>{resolve({input:TOKENS[0],output:BUTTERFLY,amountIn:10n**18n,amountOut:7n*10n**18n,path:[TOKENS[0].address,BUTTERFLY.address],block:1n,impactBps:0,wrap:false,expiresAt:Date.now()+30000})})
 expect(screen.getByRole('status',{name:'预计收到数量'})).toHaveTextContent('7')
})
