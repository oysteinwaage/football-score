import { useEffect, useState } from 'react'
import { onValue, ref } from 'firebase/database'

import { database, firebaseConfigError } from '../firebase/config'
import { normalizeByPath } from '../utils/normalizeRecords'

interface UseRealtimeState<T> {
  data: T
  loading: boolean
  error: string | null
}

export function useCollection<T extends { id?: string }>(path: string): UseRealtimeState<Array<T & { id: string }>> {
  const [data, setData] = useState<Array<T & { id: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!database) {
      setError(firebaseConfigError ?? 'Firebase er ikke konfigurert.')
      setLoading(false)
      return undefined
    }

    const unsubscribe = onValue(
      ref(database, path),
      (snapshot) => {
        const value = snapshot.val() as Record<string, T> | null
        const nextData = value
          ? Object.entries(value).map(([id, item]) => normalizeByPath<T>(path, id, item))
          : []

        setData(nextData)
        setLoading(false)
        setError(null)
      },
      (nextError) => {
        setError(nextError.message)
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [path])

  return { data, loading, error }
}

export function useDocument<T extends { id?: string }>(path: string | null): UseRealtimeState<(T & { id: string }) | null> {
  const [data, setData] = useState<(T & { id: string }) | null>(null)
  const [loading, setLoading] = useState(Boolean(path))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!path) {
      setData(null)
      setLoading(false)
      return undefined
    }

    if (!database) {
      setError(firebaseConfigError ?? 'Firebase er ikke konfigurert.')
      setLoading(false)
      return undefined
    }

    const unsubscribe = onValue(
      ref(database, path),
      (snapshot) => {
        const value = snapshot.val() as T | null
        const id = path.split('/').pop() ?? ''
        setData(value ? normalizeByPath<T>(path, id, value) : null)
        setLoading(false)
        setError(null)
      },
      (nextError) => {
        if (nextError.message.includes('NOT_FOUND')) {
          window.location.href = '/'
          return
        }
        setError(nextError.message)
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [path])

  return { data, loading, error }
}
