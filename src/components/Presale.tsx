import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPublicClient, createWalletClient, custom, http, isAddress, type Address, type EIP1193Provider, type Hash, type PublicClient, type WalletClient } from 'viem'
import { bsc } from 'viem/chains'
import { projectConfig } from '../config/project'
import type { SiteCopy } from '../content/siteContent'
import { participate, readPresaleState, waitForParticipationReceipt, type PresaleState } from '../web3/presale'
import { PresaleConsole } from './PresaleConsole'

type WalletEvent = 'accountsChanged' | 'chainChanged'
type WalletEventProvider = EIP1193Provider & {
  on?: (event: WalletEvent, listener: (value: unknown) => void) => void
  removeListener?: (event: WalletEvent, listener: (value: unknown) => void) => void
}

type Props = {
  copy: SiteCopy['presale']
  contractAddress?: Address | null
  provider?: WalletEventProvider
  publicClient?: PublicClient
  walletClient?: WalletClient
  now?: () => number
}

type ReadStatus = 'idle' | 'loading' | 'ready' | 'error'
type SubmissionStatus = 'idle' | 'submitting' | 'submitted' | 'error'

const POLL_INTERVAL_MS = 15_000

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function formatCountdown(endTime: bigint, now: number) {
  const remaining = Math.max(0, Number(endTime) - Math.floor(now / 1_000))
  const hours = Math.floor(remaining / 3_600)
  const minutes = Math.floor((remaining % 3_600) / 60)
  const seconds = remaining % 60
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
}

function injectedProvider() {
  return (window as Window & { ethereum?: WalletEventProvider }).ethereum
}

function chainIdFromEvent(value: unknown) {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return null
  const parsed = Number.parseInt(value, value.startsWith('0x') ? 16 : 10)
  return Number.isFinite(parsed) ? parsed : null
}

export function Presale({
  copy,
  contractAddress = projectConfig.presale.contractAddress,
  provider,
  publicClient,
  walletClient,
  now = Date.now,
}: Props) {
  const [account, setAccount] = useState<Address | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [presaleState, setPresaleState] = useState<PresaleState | null>(null)
  const [readStatus, setReadStatus] = useState<ReadStatus>('idle')
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>('idle')
  const [agreed, setAgreed] = useState(false)
  const [readError, setReadError] = useState<string | null>(null)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [transactionHash, setTransactionHash] = useState<Hash | null>(null)
  const [nowMs, setNowMs] = useState(() => now())
  const walletRef = useRef<WalletClient | undefined>(walletClient)
  const accountRef = useRef<Address | null>(null)
  const submittingRef = useRef(false)
  const readRequestRef = useRef(0)
  const readClient = useMemo<PublicClient | null>(() => {
    if (!contractAddress) return null
    return publicClient ?? createPublicClient({ chain: bsc, transport: http() })
  }, [contractAddress, publicClient])
  const activeProvider = useMemo<WalletEventProvider | undefined>(() => {
    if (!contractAddress) return undefined
    return provider ?? injectedProvider()
  }, [contractAddress, provider])

  const refresh = useCallback(async (targetAccount: Address | null, showLoading: boolean) => {
    if (!contractAddress || !readClient) return null
    const requestId = ++readRequestRef.current
    if (showLoading) setReadStatus('loading')
    setReadError(null)
    try {
      const state = await readPresaleState(readClient, contractAddress, targetAccount ?? undefined)
      if (requestId !== readRequestRef.current) return state
      setPresaleState(state)
      setReadStatus('ready')
      return state
    } catch (reason) {
      if (requestId === readRequestRef.current) {
        setReadError(errorMessage(reason))
        setReadStatus('error')
      }
      return null
    }
  }, [contractAddress, readClient])

  useEffect(() => {
    walletRef.current = walletClient
  }, [walletClient])

  useEffect(() => {
    if (!contractAddress || !readClient) return
    void refresh(accountRef.current, true)
  }, [contractAddress, readClient, refresh])

  useEffect(() => {
    if (!contractAddress) return
    const timer = window.setInterval(() => setNowMs(now()), 1_000)
    return () => window.clearInterval(timer)
  }, [contractAddress, now])

  useEffect(() => {
    if (!contractAddress) return
    const timer = window.setInterval(() => void refresh(accountRef.current, false), POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [contractAddress, refresh])

  useEffect(() => {
    if (!contractAddress || !activeProvider?.on) return

    const handleAccountsChanged = (value: unknown) => {
      const accounts = Array.isArray(value) ? value : []
      const nextAccount = typeof accounts[0] === 'string' && isAddress(accounts[0]) ? accounts[0] : null
      accountRef.current = nextAccount
      setAccount(nextAccount)
      setAgreed(false)
      setTransactionHash(null)
      setSubmissionError(null)
      if (!submittingRef.current) setSubmissionStatus('idle')
      setPresaleState(null)
      void refresh(nextAccount, true)
    }
    const handleChainChanged = (value: unknown) => {
      setChainId(chainIdFromEvent(value))
      setAgreed(false)
      setTransactionHash(null)
      setSubmissionError(null)
      if (!submittingRef.current) setSubmissionStatus('idle')
      void refresh(accountRef.current, true)
    }

    activeProvider.on('accountsChanged', handleAccountsChanged)
    activeProvider.on('chainChanged', handleChainChanged)
    return () => {
      activeProvider.removeListener?.('accountsChanged', handleAccountsChanged)
      activeProvider.removeListener?.('chainChanged', handleChainChanged)
    }
  }, [activeProvider, contractAddress, refresh])

  if (!contractAddress) return <PresaleConsole copy={copy} />

  const connect = async () => {
    if (submittingRef.current) return
    setSubmissionError(null)
    setSubmissionStatus('idle')
    try {
      let client = walletRef.current
      if (!client) {
        if (!activeProvider) throw new Error(copy.interaction.walletMissing)
        client = createWalletClient({ chain: bsc, transport: custom(activeProvider) })
        walletRef.current = client
      }
      const accounts = await client.requestAddresses()
      const connectedAccount = accounts[0]
      if (!connectedAccount) throw new Error(copy.interaction.walletMissing)
      accountRef.current = connectedAccount
      setAccount(connectedAccount)
      setChainId(await client.getChainId())
      setAgreed(false)
      setPresaleState(null)
      await refresh(connectedAccount, true)
    } catch (reason) {
      setSubmissionError(errorMessage(reason))
      setSubmissionStatus('error')
    }
  }

  const submit = async () => {
    const client = walletRef.current
    const validatedAccount = accountRef.current
    if (submittingRef.current || !client || !readClient || !validatedAccount || !agreed) return

    submittingRef.current = true
    setSubmissionError(null)
    setSubmissionStatus('submitting')
    try {
      const latest = await readPresaleState(readClient, contractAddress, validatedAccount)
      if (accountRef.current === validatedAccount) setPresaleState(latest)
      const ended = Number(latest.endTime) <= Math.floor(now() / 1_000)
      if (latest.paused || latest.soldOut || latest.hasParticipated || ended) {
        setSubmissionStatus('idle')
        return
      }

      const hash = await participate(client, contractAddress, validatedAccount)
      const confirmedHash = await waitForParticipationReceipt(readClient, contractAddress, hash)

      const confirmed = await readPresaleState(readClient, contractAddress, validatedAccount)
      if (accountRef.current === validatedAccount) setPresaleState(confirmed)
      if (!confirmed.hasParticipated) throw new Error('Participation was not recorded on-chain')
      setTransactionHash(confirmedHash)
      setSubmissionStatus('submitted')
    } catch (reason) {
      setSubmissionError(errorMessage(reason))
      setSubmissionStatus('error')
    } finally {
      submittingRef.current = false
    }
  }

  const ended = presaleState ? Number(presaleState.endTime) <= Math.floor(nowMs / 1_000) : false
  const submitting = submissionStatus === 'submitting'
  const blocked = readStatus === 'loading' || readStatus === 'error' || submitting
    || Boolean(presaleState?.soldOut || presaleState?.paused || presaleState?.hasParticipated || ended)
  let actionLabel = account ? copy.interaction.confirm : copy.interaction.connectWallet
  if (readStatus === 'loading' || submitting) actionLabel = copy.interaction.loading
  if (readStatus === 'error') actionLabel = copy.interaction.unavailable
  if (presaleState?.soldOut) actionLabel = copy.interaction.soldOutAction
  else if (presaleState?.hasParticipated) actionLabel = copy.interaction.alreadyParticipatedAction
  else if (presaleState?.paused) actionLabel = copy.interaction.paused
  else if (ended) actionLabel = copy.interaction.ended

  return (
    <PresaleConsole copy={copy} action={(
      <div className="presale-interaction" aria-live="polite">
        {presaleState && (
          <div className="presale-live-state">
            <span>{copy.interaction.participants}: {presaleState.participantCount.toLocaleString('en-US')} / 10,000</span>
            <span>{copy.interaction.countdown}: {formatCountdown(presaleState.endTime, nowMs)}</span>
          </div>
        )}
        {presaleState?.soldOut && <p className="presale-state-message">{copy.interaction.soldOut}</p>}
        {presaleState?.paused && <p className="presale-state-message">{copy.interaction.paused}</p>}
        {ended && !presaleState?.soldOut && <p className="presale-state-message">{copy.interaction.ended}</p>}
        {presaleState?.hasParticipated && <p className="presale-state-message">{copy.interaction.alreadyParticipated}</p>}
        {account && chainId !== null && chainId !== 56 && <p className="presale-network-message">{copy.interaction.wrongNetwork}</p>}
        {account && readStatus === 'ready' && !submitting && presaleState && !presaleState.hasParticipated && !presaleState.soldOut && !presaleState.paused && !ended && (
          <label className="presale-disclosure">
            <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
            <span>{copy.interaction.disclosure}</span>
          </label>
        )}
        {readError && <p className="presale-error" role="alert">{copy.interaction.rpcError}: {readError}</p>}
        {submissionError && <p className="presale-error" role="alert">{copy.interaction.transactionError}: {submissionError}</p>}
        {submissionStatus === 'submitted' && transactionHash && <p className="presale-success" role="status">{copy.interaction.submitted}: {transactionHash}</p>}
        <button
          className="button"
          disabled={blocked || (Boolean(account) && !agreed)}
          onClick={() => void (account ? submit() : connect())}
          type="button"
        >
          {actionLabel}
        </button>
      </div>
    )} />
  )
}
