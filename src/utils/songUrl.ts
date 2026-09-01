// Suno stoppet å tillate direkte nedlasting/hotlinking av mp3-filer (krever nå
// signerte CloudFront-URL-er, og selv den offisielle /embed/-siden går i en
// redirect-loop mot auth.suno.com fordi tredjeparts-cookies blokkeres i en
// iframe). Den eneste pålitelige måten å spille av på uten å hoste filen selv,
// er å åpne suno.com/song/<id> i en egen fane (første-parts kontekst).
// Matcher både suno.com/song/<id>-lenker og gamle cdn1.suno.ai/<id>.mp3-lenker
// som ble lagret før dette ble oppdaget, slik at eksisterende data fikses uten migrering.
const SUNO_ID_PATTERN = /(?:suno\.com\/song\/|cdn\d*\.suno\.ai\/)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i

export function getSunoSongPageUrl(url: string): string | null {
  const match = url.match(SUNO_ID_PATTERN)
  return match ? `https://suno.com/song/${match[1]}` : null
}
