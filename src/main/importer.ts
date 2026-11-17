import { execFile } from 'child_process'
import { readdir, stat } from 'fs/promises'
import { basename, extname, join } from 'path'
import type { ProgramCandidate } from '../shared/types'
import { cleanTitle } from './library'

/** Programmes qui ne sont pas le jeu : désinstalleurs, installeurs, composants, rapporteurs d'erreurs… */
const NOT_A_GAME = /(unins|uninst|setup|install|redist|vcredist|vc_redist|dxwebsetup|dotnet|crash|handler|helper|updater|update|patcher|config|prereq|ue4|ue5|easyanticheat|battleye|notification|diagnos|report)/i

const MAX_CANDIDATES = 300
const MAX_DEPTH = 2

const normalize = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, '')

async function exesIn(dir: string, depth: number): Promise<{ path: string; size: number }[]> {
  let entries: import('fs').Dirent[]
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const found: { path: string; size: number }[] = []
  for (const e of entries) {
    const path = join(dir, e.name)
    if (e.isFile() && extname(e.name).toLowerCase() === '.exe' && !NOT_A_GAME.test(e.name)) {
      try {
        found.push({ path, size: (await stat(path)).size })
      } catch {
        // Fichier disparu entre-temps : on l'ignore.
      }
    } else if (e.isDirectory() && depth < MAX_DEPTH && !/^(\.|_commonredist|redist|__|\$)/i.test(e.name)) {
      found.push(...(await exesIn(path, depth + 1)))
    }
  }
  return found
}

/** Ce qui n'est pas un jeu dans les bibliothèques Steam : composants, outils, kits de développement. */
const NOT_A_STEAM_GAME = /(steamworks|redistributable|proton|steam linux runtime|dedicated server|\bsdk\b|soundtrack|wallpaper engine)/i

/** Lecture des jeux installés : Microsoft Store / Xbox, Steam, Epic, GOG et Ubisoft Connect. Chaque ligne : nom, ce qu'on ouvre, d'où prendre l'icône. */
const FIND_GAMES = String.raw`[Console]::OutputEncoding = [Text.Encoding]::UTF8
$out = New-Object System.Collections.ArrayList
function Add-Game($name, $open, $icon) { [void]$out.Add([pscustomobject]@{ Name = $name; Open = $open; Icon = $icon }) }
# Programme principal d'un dossier de jeu : le plus gros .exe qui n'est ni un installeur ni un rapporteur d'erreurs.
function Get-MainExe($dir) {
  if (-not $dir -or -not (Test-Path -LiteralPath $dir)) { return $null }
  $bad = 'crash|unins|setup|redist|dxsetup|vc_redist|dotnet|helper|updater|launcherhelper|eac|battleye|cef|webhelper'
  $f = Get-ChildItem -LiteralPath $dir -Filter *.exe -Recurse -Depth 2 -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -notmatch $bad } | Sort-Object Length -Descending | Select-Object -First 1
  if ($f) { return $f.FullName } else { return $null }
}

# Microsoft Store et Xbox : un paquet de jeu contient MicrosoftGame.config (les applications ordinaires, non).
$start = @(Get-StartApps)
foreach ($p in Get-AppxPackage) {
  if (-not $p.InstallLocation -or -not (Test-Path -LiteralPath (Join-Path $p.InstallLocation 'MicrosoftGame.config'))) { continue }
  $app = $start | Where-Object { $_.AppID -like ($p.PackageFamilyName + '!*') } | Select-Object -First 1
  if ($app) { $t = 'shell:AppsFolder\' + $app.AppID; Add-Game $app.Name $t $t }
}

# Steam : un fichier appmanifest par jeu installé, dans chaque bibliothèque.
$steam = (Get-ItemProperty 'HKCU:\Software\Valve\Steam' -ErrorAction SilentlyContinue).SteamPath
if ($steam) {
  $libs = @($steam)
  $vdf = Join-Path $steam 'steamapps\libraryfolders.vdf'
  if (Test-Path -LiteralPath $vdf) { $libs += [regex]::Matches((Get-Content -LiteralPath $vdf -Raw), '"path"\s+"([^"]+)"') | ForEach-Object { $_.Groups[1].Value.Replace('\', '\') } }
  foreach ($lib in ($libs | Select-Object -Unique)) {
    foreach ($f in (Get-ChildItem -LiteralPath (Join-Path $lib 'steamapps') -Filter 'appmanifest_*.acf' -ErrorAction SilentlyContinue)) {
      $t = Get-Content -LiteralPath $f.FullName -Raw
      $id = [regex]::Match($t, '"appid"\s+"(\d+)"').Groups[1].Value
      $name = [regex]::Match($t, '"name"\s+"([^"]*)"').Groups[1].Value
      $dir = [regex]::Match($t, '"installdir"\s+"([^"]*)"').Groups[1].Value
      # Tuile : la jaquette que Steam garde dans son cache, sinon la bannière, sinon l'icône du programme du jeu.
      $icon = $null
      foreach ($n in 'library_600x900.jpg', 'header.jpg') {
        $c = Join-Path $steam ('appcache\librarycache\' + $id + '\' + $n)
        if (Test-Path -LiteralPath $c) { $icon = $c; break }
      }
      if (-not $icon -and $dir) { $icon = Get-MainExe (Join-Path $lib ('steamapps\common\' + $dir)) }
      if ($id -and $name) { Add-Game $name ('steam://rungameid/' + $id) $icon }
    }
  }
}

# GOG : une clé de registre par jeu installé ; on lance directement son programme.
foreach ($k in (Get-ChildItem 'HKLM:\SOFTWARE\WOW6432Node\GOG.com\Games' -ErrorAction SilentlyContinue)) {
  $g = Get-ItemProperty -LiteralPath $k.PSPath
  if ($g.gameName -and $g.exe -and (Test-Path -LiteralPath $g.exe)) { Add-Game $g.gameName $g.exe $g.exe }
}

# Ubisoft Connect : une clé par jeu ; on le lance par Ubisoft Connect.
foreach ($k in (Get-ChildItem 'HKLM:\SOFTWARE\WOW6432Node\Ubisoft\Launcher\Installs' -ErrorAction SilentlyContinue)) {
  $g = Get-ItemProperty -LiteralPath $k.PSPath
  if ($g.InstallDir) { Add-Game (Split-Path $g.InstallDir.TrimEnd('/', '\') -Leaf) ('uplay://launch/' + $k.PSChildName + '/0') (Get-MainExe $g.InstallDir) }
}

# Epic Games : un fichier .item par jeu installé.
foreach ($f in (Get-ChildItem 'C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests' -Filter *.item -ErrorAction SilentlyContinue)) {
  try { $j = Get-Content -LiteralPath $f.FullName -Raw | ConvertFrom-Json } catch { continue }
  if (-not $j.DisplayName -or -not $j.AppName -or $j.bIsIncompleteInstall) { continue }
  if ($j.AppCategories -and -not ($j.AppCategories -contains 'games')) { continue }
  $exe = if ($j.InstallLocation -and $j.LaunchExecutable) { Join-Path $j.InstallLocation $j.LaunchExecutable } else { $null }
  Add-Game $j.DisplayName ('com.epicgames.launcher://apps/' + $j.AppName + '?action=launch&silent=true') $exe
}
ConvertTo-Json -InputObject @($out) -Compress`

/** Lit la sortie JSON de `FIND_GAMES` : une entrée par jeu, lancée par l'explorateur (comme un double-clic), sans doublon. */
export function parseGames(json: string, explorer: string): ProgramCandidate[] {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return []
  }
  const seen = new Set<string>()
  const out: ProgramCandidate[] = []
  for (const row of Array.isArray(data) ? data : [data]) {
    const { Name, Open, Icon } = (row ?? {}) as { Name?: unknown; Open?: unknown; Icon?: unknown }
    if (typeof Name !== 'string' || typeof Open !== 'string' || !Name.trim() || !Open.trim()) continue
    if (Open.startsWith('steam:') && NOT_A_STEAM_GAME.test(Name)) continue
    if (seen.has(Open)) continue
    seen.add(Open)
    // Un programme (GOG) se lance seul ; le reste (Store, Steam, Epic, Ubisoft) s'ouvre par l'explorateur, comme un double-clic.
    const direct = /\.exe$/i.test(Open)
    out.push({ title: Name.trim(), exe: direct ? Open : explorer, ...(direct ? {} : { args: [Open] }), ...(typeof Icon === 'string' && Icon ? { icon: Icon } : {}) })
  }
  return out.sort((a, b) => a.title.localeCompare(b.title, 'fr'))
}

/** Jeux installés sur l'ordinateur (Store, Steam, Epic). Hors Windows : liste vide, on choisit le programme à la main. */
export function installedGames(): Promise<ProgramCandidate[]> {
  if (process.platform !== 'win32') return Promise.resolve([])
  const explorer = join(process.env.SystemRoot ?? 'C:\Windows', 'explorer.exe')
  return new Promise((resolve) =>
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(FIND_GAMES, 'utf16le').toString('base64')],
      { windowsHide: true, maxBuffer: 8 << 20, timeout: 60000 },
      (err, stdout) => resolve(err ? [] : parseGames(String(stdout), explorer))
    )
  )
}

/**
 * Cherche les jeux d'un dossier : pour chacun de ses sous-dossiers directs, le programme qui a le plus de chances d'être
 * le jeu (nom proche de celui du dossier, sinon le plus gros). Le titre vient du nom du dossier.
 */
export async function findPrograms(dir: string): Promise<ProgramCandidate[]> {
  if (!dir) return []
  let entries: import('fs').Dirent[]
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const result: ProgramCandidate[] = []
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (result.length >= MAX_CANDIDATES) break
    if (!e.isDirectory() || e.name.startsWith('.')) continue
    const exes = await exesIn(join(dir, e.name), 1)
    if (exes.length === 0) continue
    const folder = normalize(e.name)
    const score = (p: { path: string; size: number }): number => {
      const name = normalize(basename(p.path, extname(p.path)))
      // Un nom très court (« a », « go ») est dans presque tous les noms de dossier : il ne prouve rien.
      const close = name.length >= 4 && (folder.includes(name) || name.includes(folder)) ? 1 : 0
      return close * 1e12 + p.size
    }
    exes.sort((a, b) => score(b) - score(a))
    result.push({ title: cleanTitle(e.name), exe: exes[0].path })
  }
  return result
}
