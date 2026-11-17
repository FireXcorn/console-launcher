import { execFile } from 'child_process'
import type { MediaAction, MediaState } from '../shared/types'


export const NO_MEDIA: MediaState = { available: false, playing: false, title: '', artist: '' }

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
[pscustomobject]@{ available = $true; playing = ($s.GetPlaybackInfo().PlaybackStatus.ToString() -eq 'Playing'); title = [string]$p.Title; artist = [string]$p.Artist } | ConvertTo-Json -Compress
`

/** Lit la réponse JSON du script Windows ; un texte inattendu donne « pas de lecteur ». */
export function parseWindowsMedia(out: string): MediaState {
  try {
    const raw = JSON.parse(out.trim().split(/\r?\n/).pop() ?? '') as Partial<MediaState>
    if (!raw.available) return NO_MEDIA
    return { available: true, playing: raw.playing === true, title: String(raw.title ?? '').slice(0, 120), artist: String(raw.artist ?? '').slice(0, 120) }
  } catch {
    return NO_MEDIA
  }
}

const gdbus = (args: string[]): Promise<string> =>
  new Promise((resolve) => execFile('gdbus', ['call', '--session', ...args], { timeout: 4000 }, (err, out) => resolve(err ? '' : String(out))))

/** Premier lecteur MPRIS (Linux) de la liste des services du bus de session. */
export function pickMprisPlayer(names: string): string | null {
  return /org\.mpris\.MediaPlayer2\.[\w.-]+/.exec(names)?.[0] ?? null
}

/** Lit « Playing » et les champs `xesam:title` / `xesam:artist` des réponses `gdbus`. */
export function parseMpris(status: string, metadata: string): MediaState {
  const title = /'xesam:title': <'((?:[^'\\]|\\.)*)'>/.exec(metadata)?.[1] ?? ''
  const artist = /'xesam:artist': <\['((?:[^'\\]|\\.)*)'/.exec(metadata)?.[1] ?? ''
  const unescape = (s: string): string => s.replace(/\\(.)/g, '$1').slice(0, 120)
  return { available: true, playing: status.includes('Playing'), title: unescape(title), artist: unescape(artist) }
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
  return parseMpris(await get('PlaybackStatus'), await get('Metadata'))
}

function windowsMedia(action?: MediaAction): Promise<MediaState> {
  return new Promise((resolve) =>
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(WINDOWS_SCRIPT, 'utf16le').toString('base64')],
      { env: { ...process.env, CL_MEDIA_ACTION: action ?? '' }, windowsHide: true, timeout: 8000 },
      (err, out) => resolve(err ? NO_MEDIA : parseWindowsMedia(String(out)))
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
