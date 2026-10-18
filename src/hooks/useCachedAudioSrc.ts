import { useEffect, useState } from 'react'

import { releaseAudioUrl, resolveCachedAudioUrl } from '../utils/audioCache'

// Henter mp3-filen (fra lokal cache eller nett) først når `enabled` blir true,
// slik at sanger brukeren aldri spiller ikke lastes ned.
export function useCachedAudioSrc(url: string | undefined, enabled: boolean) {
  const [resolved, setResolved] = useState<{ url: string; src: string } | null>(null)
  const src = url && resolved?.url === url ? resolved.src : undefined
  const needsResolve = Boolean(enabled && url && !src)

  useEffect(() => {
    if (!needsResolve || !url) return
    let cancelled = false
    void resolveCachedAudioUrl(url).then((nextSrc) => {
      if (cancelled) {
        releaseAudioUrl(nextSrc)
        return
      }
      setResolved({ url, src: nextSrc })
    })
    return () => {
      cancelled = true
    }
  }, [needsResolve, url])

  useEffect(() => {
    if (!resolved) return
    return () => releaseAudioUrl(resolved.src)
  }, [resolved])

  return { src, loading: needsResolve }
}
