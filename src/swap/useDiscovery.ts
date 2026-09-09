import { useCallback, useEffect, useState } from 'react'
import { STOCK_TOKENS } from './config'
import type { MarketSnapshot } from './marketData'
const KEY = 'butterfly-swap-favorites-v1'
const allowed = new Set(STOCK_TOKENS.map(t => t.address.toLowerCase()))
export function readFavorites(): string[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === 'string' && allowed.has(v)))].slice(0, 100) : [] } catch { return [] }
}
export function useFavorites() {
  const [favorites, setFavorites] = useState(readFavorites)
  const [storageError, setStorageError] = useState(false)
  useEffect(() => { const onStorage = (e: StorageEvent) => { if (e.key === KEY || e.key === null) setFavorites(readFavorites()) }; window.addEventListener('storage', onStorage); return () => window.removeEventListener('storage', onStorage) }, [])
  const toggle = (address: string) => {
    const key = address.toLowerCase()
    if (!allowed.has(key)) return
    const next = favorites.includes(key) ? favorites.filter(a => a !== key) : [...favorites, key]
    setFavorites(next)
    try { localStorage.setItem(KEY, JSON.stringify(next)); setStorageError(false) } catch { setStorageError(true) }
  }
  return { favorites, toggle, storageError }
}
export function useMarketSnapshot() {
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [request, setRequest] = useState(0)
  const refresh = useCallback(() => setRequest(n => n + 1), [])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    void fetch('/api/stock-markets', { signal: controller.signal }).then(async r => {
      if (!r.ok) throw new Error('unavailable')
      const data = await r.json() as MarketSnapshot
      if (!Number.isFinite(data.fetchedAt) || !data.markets || typeof data.markets !== 'object') throw new Error('invalid')
      if (!controller.signal.aborted) { setSnapshot(data); setError(false) }
    }).catch(() => { if (!controller.signal.aborted) setError(true) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [request])
  useEffect(() => { const id = window.setInterval(() => { if (!document.hidden) refresh() }, 60_000); return () => clearInterval(id) }, [refresh])
  return { snapshot, loading, error, refresh }
}
