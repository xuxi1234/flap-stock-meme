import { describe, expect, it } from 'vitest'
import type { Address, Hash } from 'viem'
import { classifyTransactionError, loadParticipationRecord, saveParticipationRecord } from './participationRecord'

const account = '0x2222222222222222222222222222222222222222' as Address
const hash = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Hash

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  }
}

describe('participation record', () => {
  it('saves and retrieves the latest broadcast hash by normalized account', () => {
    const storage = memoryStorage()
    saveParticipationRecord(storage, { account, hash, status: 'broadcast', amountBnb: '0.05', submittedAt: 1_788_700_000_000 })

    expect(loadParticipationRecord(storage, account.toUpperCase() as Address)).toEqual({
      account,
      hash,
      status: 'broadcast',
      amountBnb: '0.05',
      submittedAt: 1_788_700_000_000,
    })
  })

  it('returns no record for malformed or unrelated storage data', () => {
    const storage = memoryStorage()
    storage.setItem(`flap-participation:v1:${account.toLowerCase()}`, '{"status":"broadcast"}')

    expect(loadParticipationRecord(storage, account)).toBeNull()
  })

  it('classifies a wallet rejection separately from a send failure', () => {
    expect(classifyTransactionError({ code: 4001, message: 'User rejected request' }, false)).toBe('rejected')
    expect(classifyTransactionError(new Error('RPC unavailable'), false)).toBe('failed')
  })

  it('preserves a broadcast transaction as uncertain when confirmation lookup fails', () => {
    expect(classifyTransactionError(new Error('RPC unavailable'), true)).toBe('uncertain')
  })
})
