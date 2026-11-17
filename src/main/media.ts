import { execFile } from 'child_process'
import { readFileSync, statSync } from 'fs'
import type { MediaAction, MediaState } from '../shared/types'


export const NO_MEDIA: MediaState = { available: false, playing: false, title: '', artist: '', art: '', position: 0, duration: 0 }

// Windows : le contrôle des médias du système (le même que les touches multimédia du clavier), valable pour toute appli de musique.
// L'action (CL_MEDIA_ACTION) est l'un de nos trois mots fixes, jamais un texte saisi.
const WINDOWS_SCRIPT = String.raw`$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$tick = [char]96
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq ('IAsyncOperation' + $tick + '1') })[0]
function Await($op, $type) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); [void]$t.Wait(-1); $t.Result }
$mgrType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$mgr = Await ($mgrType::RequestAsync()) $mgrType
# Seulement les applications de musique du lanceur (pas la vidéo d'un onglet de navigateur).
$s = $mgr.GetSessions() | Where-Object { $_.SourceAppUserModelId -match 'Spotify|AppleMusic|iTunes' } | Select-Object -First 1
if (-not $s) { '{"available":false}'; exit }
switch ($env:CL_MEDIA_ACTION) {
  'playpause' { [void](Await ($s.TryTogglePlayPauseAsync()) ([bool])) }
  'next' { [void](Await ($s.TrySkipNextAsync()) ([bool])) }
  'previous' { [void](Await ($s.TrySkipPreviousAsync()) ([bool])) }
}
$propsType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType = WindowsRuntime]
$p = Await ($s.TryGetMediaPropertiesAsync()) $propsType
$tl = $s.GetTimelineProperties()
$key = [string]$p.Title + '|' + [string]$p.Artist
# La pochette n'est lue que si le morceau a changé (CL_MEDIA_KNOWN : celui déjà connu du lanceur).
$art = ''
if ($p.Thumbnail -and $env:CL_MEDIA_KNOWN -ne $key) {
  try {
    $rt = [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime]
    $stream = Await ($p.Thumbnail.OpenReadAsync()) $rt
    $asStream = [System.IO.WindowsRuntimeStreamExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsStreamForRead' -and $_.GetParameters().Count -eq 1 } | Select-Object -First 1
    $net = $asStream.Invoke($null, @($stream))
    $ms = New-Object IO.MemoryStream
    $net.CopyTo($ms)
    $bytes = $ms.ToArray()
    # Le type de l'image se lit dans ses premiers octets (89 50 = PNG, sinon JPEG).
    $mime = if ($bytes.Length -gt 1 -and $bytes[0] -eq 0x89 -and $bytes[1] -eq 0x50) { 'image/png' } else { 'image/jpeg' }
    if ($bytes.Length -lt 3000000) { $art = 'data:' + $mime + ';base64,' + [Convert]::ToBase64String($bytes) }
  } catch { }
}
[pscustomobject]@{
  available = $true
  playing = ($s.GetPlaybackInfo().PlaybackStatus.ToString() -eq 'Playing')
  title = [string]$p.Title
  artist = [string]$p.Artist
  art = $art
  position = [math]::Round(($tl.Position - $tl.StartTime).TotalSeconds)
  duration = [math]::Round(($tl.EndTime - $tl.StartTime).TotalSeconds)
} | ConvertTo-Json -Compress
`

/** Lit la réponse JSON du script Windows ; un texte inattendu donne « pas de lecteur ». */
export function parseWindowsMedia(out: string): MediaState {
  try {
    const raw = JSON.parse(out.trim().split(/\r?\n/).pop() ?? '') as Partial<MediaState>
    if (!raw.available) return NO_MEDIA
    const secs = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : 0)
    return {
      available: true,
      playing: raw.playing === true,
      title: String(raw.title ?? '').slice(0, 120),
      artist: String(raw.artist ?? '').slice(0, 120),
      art: typeof raw.art === 'string' && raw.art.startsWith('data:image/') ? raw.art : '',
      position: secs(raw.position),
      duration: secs(raw.duration)
    }
  } catch {
    return NO_MEDIA
  }
}

const gdbus = (args: string[]): Promise<string> =>
  new Promise((resolve) => execFile('gdbus', ['call', '--session', ...args], { timeout: 4000 }, (err, out) => resolve(err ? '' : String(out))))

/** Spotify (Linux) parmi les services du bus de session : pas le navigateur ni un autre lecteur, comme sous Windows. */
export function pickMprisPlayer(names: string): string | null {
  return /org\.mpris\.MediaPlayer2\.spotify[\w.-]*/i.exec(names)?.[0] ?? null
}

/** Lit « Playing » et les champs `xesam:title` / `xesam:artist` des réponses `gdbus`. */
export function parseMpris(status: string, metadata: string, position = ''): MediaState {
  const title = /'xesam:title': <'((?:[^'\\]|\\.)*)'>/.exec(metadata)?.[1] ?? ''
  const artist = /'xesam:artist': <\['((?:[^'\\]|\\.)*)'/.exec(metadata)?.[1] ?? ''
  const unescape = (s: string): string => s.replace(/\\(.)/g, '$1').slice(0, 120)
  const micro = (text: string): number => Math.round(Number(/(?:int64|<)\s*(\d+)/.exec(text)?.[1] ?? 0) / 1e6)
  return {
    available: true,
    playing: status.includes('Playing'),
    title: unescape(title),
    artist: unescape(artist),
    art: '',
    position: micro(position),
    duration: micro(/'mpris:length': <(?:int64 |uint64 )?\d+>/.exec(metadata)?.[0] ?? '')
  }
}

const MPRIS_PATH = ['--object-path', '/org/mpris/MediaPlayer2']
const PLAYER = 'org.mpris.MediaPlayer2.Player'

async function linuxMedia(action?: MediaAction): Promise<MediaState> {
  const player = pickMprisPlayer(await gdbus(['--dest', 'org.freedesktop.DBus', '--object-path', '/org/freedesktop/DBus', '--method', 'org.freedesktop.DBus.ListNames']))
  if (!player) return NO_MEDIA
  if (action) {
    const method = { playpause: 'PlayPause', next: 'Next', previous: 'Previous' }[action]
    await gdbus(['--dest', player, ...MPRIS_PATH, '--method', `${PLAYER}.${method}`])
  }
  const get = (prop: string): Promise<string> => gdbus(['--dest', player, ...MPRIS_PATH, '--method', 'org.freedesktop.DBus.Properties.Get', PLAYER, prop])
  const metadata = await get('Metadata')
  const state = parseMpris(await get('PlaybackStatus'), metadata, await get('Position'))
  // Pochette : seulement un fichier local (file://) ; une adresse internet ne passerait pas la politique de sécurité de la page.
  const url = /'mpris:artUrl': <'file:\/\/([^']+)'>/.exec(metadata)?.[1]
  if (url) {
    try {
      const file = decodeURIComponent(url)
      const mime = /\.png$/i.test(file) ? 'image/png' : /\.jpe?g$/i.test(file) ? 'image/jpeg' : ''
      if (mime && statSync(file).size < 3_000_000) state.art = `data:${mime};base64,${readFileSync(file).toString('base64')}`
    } catch {
      // pas de pochette lisible : on affiche sans
    }
  }
  return state
}

// La pochette ne change pas tant que le morceau est le même : elle est lue une fois et gardée.
let artCache = { key: '', art: '' }

function windowsMedia(action?: MediaAction): Promise<MediaState> {
  return new Promise((resolve) =>
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(WINDOWS_SCRIPT, 'utf16le').toString('base64')],
      { env: { ...process.env, CL_MEDIA_ACTION: action ?? '', CL_MEDIA_KNOWN: artCache.key }, windowsHide: true, timeout: 8000 },
      (err, out) => {
        const state = err ? NO_MEDIA : parseWindowsMedia(String(out))
        if (!state.available) return resolve(state)
        const key = `${state.title}|${state.artist}`
        if (state.art) artCache = { key, art: state.art }
        else if (artCache.key === key) state.art = artCache.art
        resolve(state)
      }
    )
  )
}

let busy: Promise<MediaState> | null = null

/** État du lecteur de musique, après avoir envoyé `action` s'il y en a une. Un seul appel à la fois (le script est lent à démarrer). */
export function mediaCommand(action?: MediaAction): Promise<MediaState> {
  if (process.platform !== 'win32' && process.platform !== 'linux') return Promise.resolve(NO_MEDIA)
  const run = async (): Promise<MediaState> => (process.platform === 'win32' ? windowsMedia(action) : linuxMedia(action))
  const next = (busy ?? Promise.resolve(NO_MEDIA)).then(run, run)
  busy = next.finally(() => {
    if (busy === next) busy = null
  })
  return next
}
