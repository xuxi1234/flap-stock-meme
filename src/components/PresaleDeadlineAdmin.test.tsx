import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { decodeFunctionData, encodeAbiParameters, toFunctionSelector, type EIP1193Provider } from 'viem'
import { PresaleDeadlineAdmin } from './PresaleDeadlineAdmin'
import { deadlineAdminAbi } from '../web3/presaleAdmin'

const owner = '0xbE37AB912De351B9312FA593C9f99e3279FDB0a2'
const contract = '0x409c9448172b0f244a6823e91ad669281294622b'
const sent: Record<string, unknown>[] = []
function setupWallet(send: () => Promise<unknown>) {
  sent.length = 0
  vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init: RequestInit) => {
    const request = JSON.parse(init.body as string)
    let result: string
    if (request.method === 'eth_chainId') result = '0x38'
    else if (request.method === 'eth_call') {
      const data = request.params[0].data as string
      if (data.startsWith(toFunctionSelector('owner()'))) result = encodeAbiParameters([{type:'address'}], [owner])
      else if (data.startsWith(toFunctionSelector('endTime()'))) result = encodeAbiParameters([{type:'uint64'}], [1788969599n])
      else if (data.startsWith(toFunctionSelector('setEndTime(uint64)'))) result = '0x'
      else throw new Error(`Unexpected call ${data}`)
    } else throw new Error(`Unexpected RPC ${request.method}`)
    return new Response(JSON.stringify({jsonrpc:'2.0', id:request.id, result}), {headers:{'Content-Type':'application/json'}})
  }))
  const provider = { request: async ({method, params}: {method:string;params?:unknown[]}) => {
    if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [owner]
    if (method === 'eth_chainId') return '0x38'
    if (method === 'eth_sendTransaction') { sent.push(params![0] as Record<string,unknown>); return send() }
    throw new Error(`Unexpected wallet request ${method}`)
  }} as EIP1193Provider
  const announce = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {detail:{info:{uuid:'test-metamask',name:'MetaMask',icon:'',rdns:'io.metamask'},provider}}))
  window.addEventListener('eip6963:requestProvider', announce)
  return () => window.removeEventListener('eip6963:requestProvider', announce)
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
async function connect() {
  fireEvent.click(screen.getByRole('button', {name:'连接管理员钱包'}))
  fireEvent.click(await screen.findByRole('button', {name:/MetaMask/}))
  await waitFor(() => expect(screen.getByRole('button', {name:'确认同步至上述截止时间'})).toBeEnabled())
}

describe('presale admin wallet interaction', () => {
  it('recognizes the connected owner instead of still asking to connect', async () => {
    const dispose = setupWallet(async () => { throw new Error('must not send while connecting') })
    try {
      render(<PresaleDeadlineAdmin />)
      await connect()
      expect(screen.getByRole('status')).toHaveTextContent('管理员已连接')
      expect(sent).toHaveLength(0)
    } finally { dispose() }
  })
  it('shows the wallet confirmation stage and sends exactly one correct deadline update', async () => {
    let reject!: (error: unknown) => void
    const dispose = setupWallet(() => new Promise((_, fail) => { reject = fail }))
    try {
      render(<PresaleDeadlineAdmin />)
      await connect()
      fireEvent.click(screen.getByRole('button', {name:'确认同步至上述截止时间'}))
      await waitFor(() => expect(sent).toHaveLength(1))
      const request = sent[0]
      expect(String(request.to).toLowerCase()).toBe(contract)
      expect(String(request.from).toLowerCase()).toBe(owner.toLowerCase())
      const decoded = decodeFunctionData({abi:deadlineAdminAbi,data:request.data as `0x${string}`})
      expect(decoded).toMatchObject({functionName:'setEndTime',args:[1789142400n]})
      expect(request.value === undefined || request.value === '0x0').toBe(true)
      expect(screen.getByRole('status')).toHaveTextContent('等待钱包确认')
      expect(screen.getByRole('button', {name:'等待钱包确认'})).toBeDisabled()
      await act(async () => { reject({code:4001,message:'User rejected request'}) })
    } finally { dispose() }
  })
  it('explains an existing wallet request instead of swallowing its error', async () => {
    const dispose = setupWallet(async () => { throw {code:-32002,message:'Request already pending'} })
    try {
      render(<PresaleDeadlineAdmin />)
      await connect()
      fireEvent.click(screen.getByRole('button', {name:'确认同步至上述截止时间'}))
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('已有待处理请求'))
      expect(screen.getByRole('status')).toHaveTextContent('-32002')
      expect(sent).toHaveLength(1)
    } finally { dispose() }
  })
})
