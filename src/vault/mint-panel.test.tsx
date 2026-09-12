import {render,screen,waitFor,cleanup} from '@testing-library/react'
import {afterEach,beforeEach,it,expect,vi} from 'vitest'
import acceptance from '../../public/vault/mint-acceptance.json'
import {OWNER} from './protocol'
import deployment from '../../public/vault/mint-deployment.json'
const mocks=vi.hoisted(()=>({verify:vi.fn(),prepare:vi.fn(),read:vi.fn(),campaign:vi.fn()}))
vi.mock('./mint',async importOriginal=>({...await importOriginal<object>(),verifyMintDeployment:mocks.verify,readCampaign:mocks.campaign}))
vi.mock('./service',()=>({client:{readContract:mocks.read},prepare:mocks.prepare,records:()=>[]}))
import {MintPanel} from './MintPanel'
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();mocks.read.mockResolvedValue(0n);mocks.campaign.mockImplementation(async(_c,_f,address,account)=>({address,config:{name:acceptance.name,symbol:acceptance.symbol,minimumTokensOut:100000n*10n**18n},creator:OWNER,total:0n,target:2n,deadline:BigInt(acceptance.deadline),launched:false,aborted:false,shares:account===OWNER?1n:0n,claimable:[0n,0n],token:'0x0000000000000000000000000000000000000000',blockNumber:1n}));mocks.verify.mockResolvedValue({address:deployment.factory,implementation:deployment.implementation,hash:deployment.transactionHash})})
afterEach(cleanup)
const mount=()=>render(<MintPanel account={null} busy={false} run={async fn=>{try{await fn()}catch{/* parent displays error */}}} status={()=>{}} review={()=>{}} connect={()=>{}}/> )
it('automatically verifies the confirmed factory and never offers repeat deployment',async()=>{
 mount();await screen.findByRole('button',{name:'检查认购'});
 expect(mocks.verify).toHaveBeenCalledWith(expect.anything(),deployment.transactionHash);
 expect(screen.queryByRole('button',{name:'检查 Mint 工厂部署'})).toBeNull();
 expect(mocks.prepare).not.toHaveBeenCalled();
})
it('keeps campaign creation unavailable when on-chain verification fails',async()=>{
 mocks.verify.mockRejectedValue(Error('RPC unavailable'));mount();await waitFor(()=>expect(mocks.verify).toHaveBeenCalled());
 expect(screen.queryByRole('button',{name:'检查创建 Mint 项目'})).toBeNull();
 expect(screen.getByRole('button',{name:'核验工厂'})).toBeTruthy();
 expect(mocks.prepare).not.toHaveBeenCalled();
})

it('reloads participant shares when the connected wallet changes',async()=>{
 const props={busy:false,run:async(fn:()=>Promise<void>)=>{await fn()},status:()=>{},review:()=>{},connect:()=>{}};
 const view=render(<MintPanel {...props} account={null}/>);await screen.findByRole('button',{name:'检查认购'});
 expect((screen.getByRole('button',{name:'检查退回全部份额'}) as HTMLButtonElement).disabled).toBe(true);
 view.rerender(<MintPanel {...props} account={OWNER}/>);
 await waitFor(()=>expect((screen.getByRole('button',{name:'检查退回全部份额'}) as HTMLButtonElement).disabled).toBe(false));
 expect(mocks.campaign).toHaveBeenLastCalledWith(expect.anything(),deployment.factory,acceptance.campaign,OWNER);
 expect(mocks.prepare).not.toHaveBeenCalled();
})
