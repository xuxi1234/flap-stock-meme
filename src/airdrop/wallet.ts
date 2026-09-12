import { isAddress, type EIP1193Provider } from 'viem'

// Account permission only: never signs, approves tokens, or submits transactions.
export async function requestSender(provider: EIP1193Provider, reselect = false) {
  try {
    if (reselect) await provider.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] })
    const accounts = await provider.request({ method: 'eth_requestAccounts' })
    if (!accounts[0] || !isAddress(accounts[0])) throw Error('钱包没有提供账户，请在钱包中允许本站连接。')
    if (Number(await provider.request({ method: 'eth_chainId' })) !== 56) throw Error('请先在钱包中切换到 BNB Smart Chain，再连接。')
    // Read again after the permission dialog and chain check, rather than retaining the old sender.
    const current = await provider.request({ method: 'eth_accounts' })
    if (!current[0] || !isAddress(current[0])) throw Error('钱包账户已断开，请重新连接。')
    return current[0]
  } catch (error) {
    const code = (error as { code?: number })?.code
    if (code === 4001) throw Error('你已取消账户选择，尚未连接新账户。')
    if (code === 4200 || code === -32601) throw Error('此钱包不支持网页重选账户。请在钱包的已连接网站中更改本站账户，再重新连接。')
    if (code === -32002) throw Error('钱包已有待处理请求，请打开钱包完成账户选择。')
    throw error instanceof Error ? error : Error('钱包连接失败，请打开钱包检查连接请求。')
  }
}
