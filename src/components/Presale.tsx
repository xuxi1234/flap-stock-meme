import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPublicClient, createWalletClient, custom, http, isAddress, type Address, type EIP1193Provider, type Hash, type PublicClient, type WalletClient } from 'viem'
import { bsc } from 'viem/chains'
import { projectConfig } from '../config/project'
import type { SiteCopy } from '../content/siteContent'
import { classifyTransactionError, loadParticipationRecord, saveParticipationRecord, type ParticipationRecord } from '../web3/participationRecord'
import { participate, readPresaleState, waitForParticipationReceipt, type PresaleState } from '../web3/presale'
import { discoverWalletProviders, type WalletProviderDetail } from '../web3/walletProviders'
import { CopyControl } from './CopyControl'
import { MyParticipation } from './MyParticipation'
import { PresaleConsole } from './PresaleConsole'
import { WalletChooser } from './WalletChooser'

type WalletEvent = 'accountsChanged' | 'chainChanged'
type WalletEventProvider = EIP1193Provider & { on?: (event: WalletEvent, listener: (value: unknown) => void) => void; removeListener?: (event: WalletEvent, listener: (value: unknown) => void) => void }
type ReadStatus = 'idle' | 'loading' | 'ready' | 'error'
type TransactionPhase = 'idle' | 'awaitingSignature' | 'broadcast' | 'confirming' | 'confirmed' | 'rejected' | 'failed' | 'uncertain'
export type PresaleDisplayStatus = 'live' | 'paused' | 'ended' | 'soldOut' | 'participated' | 'unavailable'

type Props = { walletRequest?: number; copy: SiteCopy['presale']; contractAddress?: Address | null; provider?: WalletEventProvider; publicClient?: PublicClient; walletClient?: WalletClient; now?: () => number; onAccountChange?: (account: Address | null) => void; onStatusChange?: (status: PresaleDisplayStatus) => void }

const POLL_INTERVAL_MS = 15_000
const deterministicFailures = ['reverted', 'cancelled', 'replaced with a different call']
const errorMessage = (error: unknown) => error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : String(error)
const formatCountdown = (endTime: bigint, now: number) => {
  const remaining = Math.max(0, Number(endTime) - Math.floor(now / 1_000))
  const days = Math.floor(remaining / 86_400)
  const hours = Math.floor((remaining % 86_400) / 3_600)
  const minutes = Math.floor((remaining % 3_600) / 60)
  const seconds = remaining % 60
  return [days, hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
}
const parseChainId = (value: unknown) => typeof value === 'number' ? value : typeof value === 'string' ? Number.parseInt(value, value.startsWith('0x') ? 16 : 10) : null

export function Presale({ copy, contractAddress = projectConfig.presale.contractAddress, provider, publicClient, walletClient, now = Date.now, onStatusChange, onAccountChange, walletRequest = 0 }: Props) {
  const [account, setAccount] = useState<Address | null>(null)
  useEffect(() => { onAccountChange?.(account) }, [account, onAccountChange])
  const [chainId, setChainId] = useState<number | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<WalletEventProvider | undefined>(provider)
  const [providers, setProviders] = useState<WalletProviderDetail[]>([])
  const [chooserOpen, setChooserOpen] = useState(false)
  useEffect(() => { if (walletRequest > 0) setChooserOpen(true) }, [walletRequest])
  const [presaleState, setPresaleState] = useState<PresaleState | null>(null)
  const [readStatus, setReadStatus] = useState<ReadStatus>('idle')
  const [readError, setReadError] = useState<string | null>(null)
  const [phase, setPhase] = useState<TransactionPhase>('idle')
  const [phaseError, setPhaseError] = useState<string | null>(null)
  const [transactionHash, setTransactionHash] = useState<Hash | null>(null)
  const [savedRecord, setSavedRecord] = useState<ParticipationRecord | null>(null)
  const [nowMs, setNowMs] = useState(() => now())
  const walletRef = useRef<WalletClient | undefined>(walletClient)
  const accountRef = useRef<Address | null>(null)
  const submittingRef = useRef(false)
  const requestRef = useRef(0)

  const readClient = useMemo(() => contractAddress ? (publicClient ?? createPublicClient({ chain: bsc, transport: http() })) : null, [contractAddress, publicClient])

  const refresh = useCallback(async (target: Address | null, showLoading = false) => {
    if (!contractAddress || !readClient) return null
    const id = ++requestRef.current
    if (showLoading) setReadStatus('loading')
    setReadError(null)
    try {
      const next = await readPresaleState(readClient, contractAddress, target ?? undefined)
      if (id === requestRef.current) { setPresaleState(next); setReadStatus('ready') }
      return next
    } catch (error) {
      if (id === requestRef.current) { setReadError(errorMessage(error)); setReadStatus('error') }
      return null
    }
  }, [contractAddress, readClient])

  useEffect(() => discoverWalletProviders(setProviders), [])
  useEffect(() => { walletRef.current = walletClient }, [walletClient])
  useEffect(() => { if (contractAddress) void refresh(accountRef.current, true) }, [contractAddress, refresh])
  useEffect(() => { if (!contractAddress) return; const timer = window.setInterval(() => setNowMs(now()), 1_000); return () => window.clearInterval(timer) }, [contractAddress, now])
  useEffect(() => { if (!contractAddress) return; const timer = window.setInterval(() => void refresh(accountRef.current), POLL_INTERVAL_MS); return () => window.clearInterval(timer) }, [contractAddress, refresh])

  useEffect(() => {
    const active = selectedProvider
    if (!active?.on) return
    const accountsChanged = (value: unknown) => {
      const first = Array.isArray(value) ? value[0] : null
      const next = typeof first === 'string' && isAddress(first) ? first : null
      accountRef.current = next; setAccount(next); setPhase('idle'); setTransactionHash(null); setPhaseError(null)
      setSavedRecord(next ? loadParticipationRecord(localStorage, next) : null)
      void refresh(next, true)
    }
    const chainChanged = (value: unknown) => { setChainId(parseChainId(value)); void refresh(accountRef.current, true) }
    active.on('accountsChanged', accountsChanged); active.on('chainChanged', chainChanged)
    return () => { active.removeListener?.('accountsChanged', accountsChanged); active.removeListener?.('chainChanged', chainChanged) }
  }, [refresh, selectedProvider])

  const connectWith = async (detail?: WalletProviderDetail) => {
    setChooserOpen(false); setPhaseError(null); setPhase('idle')
    try {
      const walletProvider = (detail?.provider ?? selectedProvider ?? provider) as WalletEventProvider | undefined
      if (walletProvider) setSelectedProvider(walletProvider)
      let client = walletClient ?? walletRef.current
      if (!client) {
        if (!walletProvider) { setChooserOpen(true); return }
        client = createWalletClient({ chain: bsc, transport: custom(walletProvider) })
      }
      walletRef.current = client
      const addresses = await client.requestAddresses()
      const next = addresses[0]
      if (!next) throw new Error(copy.interaction.walletMissing)
      accountRef.current = next; setAccount(next); setChainId(await client.getChainId())
      setSavedRecord(loadParticipationRecord(localStorage, next))
      await refresh(next, true)
    } catch (error) { setPhaseError(errorMessage(error)); setPhase('failed') }
  }

  const disconnect = () => {
    accountRef.current = null; setAccount(null); setChainId(null); setPhase('idle'); setPhaseError(null); setTransactionHash(null); setSavedRecord(null); walletRef.current = walletClient
    void refresh(null, true)
  }

  const submit = async () => {
    const client = walletRef.current
    const validatedAccount = accountRef.current
    if (!client || !validatedAccount || !readClient || submittingRef.current) return
    submittingRef.current = true; setPhaseError(null); setTransactionHash(null); setPhase('awaitingSignature')
    let broadcastHash: Hash | null = null
    try {
      const latest = await readPresaleState(readClient, contractAddress!, validatedAccount)
      setPresaleState(latest)
      if (latest.paused || latest.soldOut || latest.hasParticipated || Number(latest.endTime) <= Math.floor(now() / 1_000)) { setPhase('idle'); return }
      broadcastHash = await participate(client, contractAddress!, validatedAccount)
      setTransactionHash(broadcastHash); setPhase('broadcast')
      const initial: ParticipationRecord = { account: validatedAccount, hash: broadcastHash, status: 'broadcast', amountBnb: '0.05', submittedAt: now() }
      saveParticipationRecord(localStorage, initial); setSavedRecord(initial); setPhase('confirming')
      const confirmedHash = await waitForParticipationReceipt(readClient, contractAddress!, broadcastHash)
      setTransactionHash(confirmedHash)
      const confirmedState = await readPresaleState(readClient, contractAddress!, validatedAccount)
      setPresaleState(confirmedState)
      if (!confirmedState.hasParticipated) throw new Error('Participation record not visible yet')
      const confirmedRecord = { ...initial, hash: confirmedHash, status: 'confirmed' as const }
      saveParticipationRecord(localStorage, confirmedRecord); setSavedRecord(confirmedRecord); setPhase('confirmed')
    } catch (error) {
      const message = errorMessage(error); setPhaseError(message)
      const deterministic = deterministicFailures.some((phrase) => message.toLowerCase().includes(phrase))
      const nextPhase = deterministic ? 'failed' : classifyTransactionError(error, Boolean(broadcastHash))
      setPhase(nextPhase)
      if (broadcastHash) {
        const record: ParticipationRecord = { account: validatedAccount, hash: broadcastHash, status: nextPhase === 'uncertain' ? 'uncertain' : 'broadcast', amountBnb: '0.05', submittedAt: savedRecord?.submittedAt ?? now() }
        saveParticipationRecord(localStorage, record); setSavedRecord(record)
      }
    } finally { submittingRef.current = false }
  }

  const ended = Boolean(presaleState && Number(presaleState.endTime) <= Math.floor(nowMs / 1_000))
  const displayStatus: PresaleDisplayStatus = readStatus === 'error' ? 'unavailable' : presaleState?.soldOut ? 'soldOut' : presaleState?.paused ? 'paused' : ended ? 'ended' : presaleState?.hasParticipated ? 'participated' : 'live'
  useEffect(() => { onStatusChange?.(displayStatus) }, [displayStatus, onStatusChange])
  if (!contractAddress) return <PresaleConsole copy={copy} presaleEnabled={false} />
  const pending = ['awaitingSignature', 'broadcast', 'confirming'].includes(phase)
  const blocked = readStatus !== 'ready' || pending || displayStatus !== 'live'
  const actionLabel = !account ? copy.interaction.connectWallet : displayStatus === 'soldOut' ? copy.interaction.soldOutAction : displayStatus === 'paused' ? copy.interaction.paused : displayStatus === 'ended' ? copy.interaction.ended : displayStatus === 'participated' ? copy.interaction.alreadyParticipatedAction : displayStatus === 'unavailable' ? copy.interaction.unavailable : pending ? copy.interaction.loading : copy.interaction.confirm
  const phaseLabel = phase === 'idle' ? null : phase === 'awaitingSignature' ? copy.interaction.waitingSignature : copy.interaction[phase]

  return <PresaleConsole copy={copy} action={<div className="participation-console" aria-live="polite">
    <div className="presale-countdown"><span>{copy.interaction.countdown}</span><strong>{presaleState ? formatCountdown(presaleState.endTime, nowMs) : '—'}</strong><small>{presaleState ? 'DD : HH : MM : SS' : copy.interaction.unavailable}</small></div>
    {readError && <p className="status-message is-error" role="alert">{copy.interaction.rpcError}: {readError}</p>}
    {presaleState?.soldOut && <p className="status-message">{copy.interaction.soldOut}</p>}{presaleState?.paused && <p className="status-message">{copy.interaction.paused}</p>}{ended && <p className="status-message">{copy.interaction.ended}</p>}{presaleState?.hasParticipated && <p className="status-message is-success">{copy.interaction.alreadyParticipated}</p>}
    {account && <div className="wallet-state"><div><span>{copy.interaction.account}</span><code>{account}</code></div><div><span>{copy.interaction.network}</span><strong>{chainId === 56 ? 'BSC MAINNET · 56' : `CHAIN · ${chainId ?? '—'}`}</strong></div><div className="wallet-state-actions"><CopyControl value={account} label={copy.interaction.copy} copiedLabel={copy.interaction.copied} /><button className="text-action" type="button" onClick={disconnect}>{copy.interaction.disconnect}</button></div></div>}
    {account && chainId !== null && chainId !== 56 && <p className="status-message is-warning">{copy.interaction.wrongNetwork}</p>}
    {phaseLabel && <div className={`transaction-state phase-${phase}`}><span>{phaseLabel}</span>{phaseError && <small>{phaseError}</small>}{transactionHash && <><code>{transactionHash}</code><a href={`https://bscscan.com/tx/${transactionHash}`} target="_blank" rel="noreferrer">{copy.interaction.viewOnBscScan}</a></>}</div>}
    <button className="button button-primary participate-button" disabled={account ? blocked : false} onClick={() => void (account ? submit() : walletClient || provider ? connectWith() : setChooserOpen(true))} type="button">{actionLabel}</button>
    <MyParticipation copy={copy.interaction} account={account} hasParticipated={Boolean(presaleState?.hasParticipated)} record={savedRecord} />
    {chooserOpen && <WalletChooser copy={copy.interaction} providers={providers} onClose={() => setChooserOpen(false)} onSelect={(wallet) => void connectWith(wallet)} />}
  </div>} />
}
