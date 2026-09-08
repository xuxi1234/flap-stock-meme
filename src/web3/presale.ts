import { parseEther, type Address, type Hash, type PublicClient, type ReplacementReturnType, type WalletClient } from 'viem'
import { bsc } from 'viem/chains'
import { presaleAbi } from './presaleAbi'
import { presaleDeadlineReached } from './presaleDeadline'

const BSC_CHAIN_ID = 56
const MAX_PARTICIPANTS = 10_000n
const PARTICIPATION_VALUE = parseEther('0.05')
const PARTICIPATION_INPUT = '0xd11711a2'

export type PresaleState = {
  participantCount: bigint
  endTime: bigint
  paused: boolean
  hasParticipated: boolean
  soldOut: boolean
}

export async function readPresaleState(client: PublicClient, contract: Address, account?: Address): Promise<PresaleState> {
  const [participantCount, endTime, paused, hasParticipated] = await Promise.all([
    client.readContract({ address: contract, abi: presaleAbi, functionName: 'participantCount' }),
    client.readContract({ address: contract, abi: presaleAbi, functionName: 'endTime' }),
    client.readContract({ address: contract, abi: presaleAbi, functionName: 'paused' }),
    account
      ? client.readContract({ address: contract, abi: presaleAbi, functionName: 'hasParticipated', args: [account] })
      : Promise.resolve(false),
  ])

  return {
    participantCount,
    endTime,
    paused,
    hasParticipated,
    soldOut: participantCount >= MAX_PARTICIPANTS,
  }
}

export async function participate(walletClient: WalletClient, contract: Address | null, expectedAccount?: Address): Promise<Hash> {
  if (!contract) throw new Error('Presale contract is unavailable')
  if (presaleDeadlineReached(undefined, Date.now())) throw new Error('Private sale deadline reached')

  let accounts = await walletClient.getAddresses()
  if (accounts.length === 0) accounts = await walletClient.requestAddresses()
  const account = accounts[0]
  if (!account) throw new Error('No wallet account is available')
  if (expectedAccount && account.toLowerCase() !== expectedAccount.toLowerCase()) {
    throw new Error('Wallet account changed; reconnect required')
  }

  if (await walletClient.getChainId() !== BSC_CHAIN_ID) {
    await walletClient.switchChain({ id: BSC_CHAIN_ID })
  }

  // Recheck after account access and network switching, which can take time.
  if (presaleDeadlineReached(undefined, Date.now())) throw new Error('Private sale deadline reached')
  return walletClient.writeContract({
    account,
    address: contract,
    abi: presaleAbi,
    chain: bsc,
    functionName: 'participate',
    value: PARTICIPATION_VALUE,
  })
}

export async function waitForParticipationReceipt(publicClient: PublicClient, contract: Address, hash: Hash): Promise<Hash> {
  const replacement = { current: undefined as ReplacementReturnType | undefined }
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    onReplaced: (event) => {
      replacement.current = event
    },
  })

  const event = replacement.current
  if (event?.reason === 'cancelled') {
    throw new Error('Transaction cancelled; participation was not recorded')
  }
  if (event && (
    event.transaction.to?.toLowerCase() !== contract.toLowerCase()
    || event.transaction.value !== PARTICIPATION_VALUE
    || event.transaction.input !== PARTICIPATION_INPUT
  )) {
    throw new Error('Transaction replaced with a different call; participation was not recorded')
  }

  const confirmedReceipt = event?.transactionReceipt ?? receipt
  if (confirmedReceipt.status !== 'success') throw new Error('Transaction reverted')
  return confirmedReceipt.transactionHash
}
