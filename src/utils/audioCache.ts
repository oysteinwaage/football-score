// Lagrer mp3-filer fra Firebase Storage i nettleserens Cache Storage, slik at
// hver sang bare lastes ned én gang per enhet. Filene i Storage får alltid et
// nytt, unikt navn ved opplasting, så en URL peker aldri på endret innhold og
// cachen trenger ingen utløpstid.
// Krever CORS-oppsett på bucketen for at fetch() skal få lese filen (se cors.json):
//   gcloud storage buckets update gs://<bucket> --cors-file=cors.json
// Feiler noe, eller nettleseren ikke støtter Cache API, faller vi tilbake til
// vanlig streaming fra URL-en.
const CACHE_NAME = 'sanger-mp3-v1'

let persistRequested = false

function cacheSupported() {
  return typeof window !== 'undefined' && 'caches' in window
}

// Ber nettleseren om å ikke rydde bort cachen ved lite lagringsplass
function requestPersistentStorage() {
  if (persistRequested) return
  persistRequested = true
  void navigator.storage?.persist?.().catch(() => undefined)
}

export async function resolveCachedAudioUrl(url: string): Promise<string> {
  if (!cacheSupported()) return url
  try {
    const cache = await caches.open(CACHE_NAME)
    let response = await cache.match(url)
    if (!response) {
      // no-store: hopp over nettleserens HTTP-cache, som kan ha en kopi lagret
      // av <audio> uten CORS-headere (og som da ville blitt blokkert)
      const networkResponse = await fetch(url, { mode: 'cors', cache: 'no-store' })
      const contentType = networkResponse.headers.get('content-type') ?? ''
      if (!networkResponse.ok || !/^(audio\/|application\/octet-stream)/.test(contentType)) return url
      await cache.put(url, networkResponse.clone())
      requestPersistentStorage()
      response = networkResponse
    }
    const blob = await response.blob()
    return URL.createObjectURL(blob)
  } catch {
    return url
  }
}

export function releaseAudioUrl(src: string) {
  if (src.startsWith('blob:')) URL.revokeObjectURL(src)
}

export async function removeCachedAudio(url: string): Promise<void> {
  if (!cacheSupported()) return
  try {
    const cache = await caches.open(CACHE_NAME)
    await cache.delete(url)
  } catch {
    // Ikke kritisk om cachen ikke kan ryddes
  }
}
