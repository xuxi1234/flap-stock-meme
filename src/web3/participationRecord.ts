import { isAddress, isHash, type Address, type Hash } from 'viem'

export type SavedParticipationStatus = 'broadcast' | 'confirmed' | 'uncertain'

export type ParticipationRecord = {
  account: Address
  hash: Hash
  status: SavedParticipationStatus
  amountBnb: '0.05'
  submittedAt: number
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

const keyFor = (account: Address) => `flap-participation:v1:${account.toLowerCase()}`

export function saveParticipationRecord(storage: StorageLike, record: ParticipationRecord) {
  storage.setItem(keyFor(record.account), JSON.stringify(record))
}

export function loadParticipationRecord(storage: StorageLike, account: Address): ParticipationRecord | null {
  const raw = storage.getItem(keyFor(account))
  if (!raw) return null

  try {
    const record = JSON.parse(raw) as Partial<ParticipationRecord>
    if (
      typeof record.account !== 'string'
      || !isAddress(record.account)
      || record.account.toLowerCase() !== account.toLowerCase()
      || typeof record.hash !== 'string'
      || !isHash(record.hash)
      || !['broadcast', 'confirmed', 'uncertain'].includes(String(record.status))
      || record.amountBnb !== '0.05'
      || typeof record.submittedAt !== 'number'
    ) return null
    return record as ParticipationRecord
  } catch {
    return null
  }
}

function errorCode(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error)) return null
  return Number((error as { code?: unknown }).code)
}

function errorText(error: unknown) {
  if (!error || typeof error !== 'object') return String(error)
  const value = error as { message?: unknown; shortMessage?: unknown }
  return `${String(value.shortMessage ?? '')} ${String(value.message ?? '')}`.toLowerCase()
}

export function classifyTransactionError(error: unknown, hashWasBroadcast: boolean): 'rejected' | 'failed' | 'uncertain' {
  if (hashWasBroadcast) return 'uncertain'
  const text = errorText(error)
  if (errorCode(error) === 4001 || text.includes('user rejected') || text.includes('user denied')) return 'rejected'
  return 'failed'
}
