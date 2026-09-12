import {render,screen,waitFor,cleanup} from '@testing-library/react'
import {afterEach,beforeEach,it,expect,vi} from 'vitest'
import deployment from '../../public/vault/mint-deployment.json'
const mocks=vi.hoisted(()=>({verify:vi.fn(),prepare:vi.fn(),read:vi.fn()}))
vi.mock('./mint',async importOriginal=>({...await importOriginal<object>(),verifyMintDeployment:mocks.verify}))
vi.mock('./service',()=>({client:{readContract:mocks.read},prepare:mocks.prepare,records:()=>[]}))
import {MintPanel} from './MintPanel'
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();mocks.read.mockResolvedValue(0n);mocks.verify.mockResolvedValue({address:deployment.factory,implementation:deployment.implementation,hash:deployment.transactionHash})})
afterEach(cleanup)
const mount=()=>render(<MintPanel account={null} busy={false} run={async fn=>{try{await fn()}catch{/* parent displays error */}}} status={()=>{}} review={()=>{}} connect={()=>{}}/> )
it('automatically verifies the confirmed factory and never offers repeat deployment',async()=>{
 mount();await screen.findByRole('button',{name:'检查创建 Mint 项目'});
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
