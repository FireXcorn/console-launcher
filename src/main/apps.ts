import { chmodSync, lstatSync, closeSync, copyFileSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, statSync } from 'fs'
import { homedir } from 'os'
import { basename, dirname, extname, join } from 'path'
import { execFile, spawn } from 'child_process'
import type { AppInfo } from '../shared/types'
import { azaharSdmc } from './pkvault'

/** Une petite application libre que le lanceur sait installer et ouvrir. */
export interface AppDef {
  id: string
  title: string
  description: string
  /** Page officielle où l'on télécharge l'application (le lanceur ne télécharge rien tout seul). */
  page: string
  /** Nom du programme à lancer une fois installé. */
  exe: string
  /** Ce que l'on doit choisir après le téléchargement. */
  fileHint: string
  platforms: NodeJS.Platform[]
  /** Programme livré avec le lanceur (chemin relatif au dossier « emulators ») : rien à télécharger. */
  bundled?: Partial<Record<NodeJS.Platform, string>>
  /** Phrase affichée une fois l'application prête (ex. où sont les sauvegardes à lui indiquer). */
  note?: (home: string) => string
  /**
   * Application déjà installée sur l'ordinateur (pas livrée par le lanceur) : emplacements habituels de son programme,
   * par système. `%APPDATA%`, `%LOCALAPPDATA%` et `~` sont remplacés.
   */
  system?: Partial<Record<NodeJS.Platform, string[]>>
  /** Installation automatique en arrière-plan, par système : commandes lancées l'une après l'autre (gestionnaire de paquets du système). */
  install?: Partial<Record<NodeJS.Platform, { file: string; args: string[] }[]>>
  /** Application du Microsoft Store : identifiant à donner à l'explorateur (`shell:AppsFolder\<id>`) pour qu'elle s'ouvre au premier plan. */
  shellApp?: Partial<Record<NodeJS.Platform, string>>
  /** Ouverte en plein écran sans bordure par-dessus le lanceur, comme un jeu (Windows). */
  fullscreen?: boolean
}

export const APPS: AppDef[] = [
  {
    id: 'pkvault',
    title: 'Pokémon Home',
    description:
      'Range tes Pokémon dans des boîtes et passe-les d’un jeu à un autre (Game Boy, GBA, DS, 3DS). Livré avec le lanceur. Il garde une copie de tes sauvegardes avant chaque modification.',
    page: 'https://github.com/Chnapy/PKVault/releases/latest',
    exe: 'PKVault.exe',
    fileHint: 'le fichier PKVault téléchargé',
    platforms: ['win32', 'linux'],
    bundled: { win32: 'pkvault/PKVault.exe', linux: 'pkvault.AppImage' },
    // shortcut: chemins Azahar « standard » ; à revoir si Azahar est portable ou installé en Flatpak.
    note: (home) => `Jeux 3DS : les sauvegardes d’Azahar (${azaharSdmc(home)}) sont reconnues dès le premier lancement d’un jeu 3DS.`
  },
  {
    id: 'spotify',
    title: 'Spotify',
    description: 'Ta musique Spotify. Ouvre l’application Spotify déjà installée sur ton ordinateur.',
    page: 'https://www.spotify.com/download/',
    exe: 'Spotify.exe',
    fileHint: '',
    platforms: ['win32', 'linux'],
    fullscreen: true,
    // shortcut: emplacements habituels (installateur classique, Microsoft Store, paquets Linux) ; à compléter si Spotify est ailleurs.
    system: {
      win32: ['%APPDATA%\\Spotify\\Spotify.exe', '%LOCALAPPDATA%\\Microsoft\\WindowsApps\\Spotify.exe'],
      linux: ['/usr/bin/spotify', '/snap/bin/spotify', '/var/lib/flatpak/exports/bin/com.spotify.Client', '~/.local/share/flatpak/exports/bin/com.spotify.Client']
    },
    install: {
      win32: [{ file: 'winget', args: ['install', '--id', 'Spotify.Spotify', '-e', '--silent', '--accept-package-agreements', '--accept-source-agreements'] }],
      // shortcut: Linux sans Flatpak : pas d'installation automatique (il faudrait les droits administrateur), la page officielle sert.
      linux: [
        { file: 'flatpak', args: ['remote-add', '--user', '--if-not-exists', 'flathub', 'https://dl.flathub.org/repo/flathub.flatpakrepo'] },
        { file: 'flatpak', args: ['install', '--user', '-y', 'flathub', 'com.spotify.Client'] }
      ]
    }
  },
  {
    id: 'applemusic',
    title: 'Apple Music',
    description: 'Ta musique Apple Music. Ouvre l’application Apple Music (Microsoft Store) installée sur ton ordinateur.',
    page: 'https://apps.microsoft.com/detail/9PFHDD62MXS1',
    exe: 'AppleMusic.exe',
    fileHint: '',
    platforms: ['win32'],
    shellApp: { win32: 'AppleInc.AppleMusicWin_nzyj5cx40ttqa!App' },
    system: { win32: ['%LOCALAPPDATA%\\Microsoft\\WindowsApps\\AppleMusic.exe'] },
    install: {
      win32: [{ file: 'winget', args: ['install', '--id', '9PFHDD62MXS1', '--source', 'msstore', '--accept-package-agreements', '--accept-source-agreements'] }]
    }
  }
]

/**
 * Installe l'application avec le gestionnaire de paquets du système, sans rien demander (les commandes sont fixes, jamais saisies).
 * Renvoie null si elle est installée à la fin, sinon la raison de l'échec.
 */
export async function installAutomatically(app: AppDef, platform: NodeJS.Platform = process.platform): Promise<string | null> {
  const steps = app.install?.[platform]
  if (!steps) return 'Installation automatique impossible sur ce système : utilise la page de téléchargement.'
  for (const step of steps) {
    const err = await new Promise<string | null>((resolve) =>
      execFile(step.file, step.args, { windowsHide: true, timeout: 15 * 60 * 1000 }, (e, _out, stderr) => {
        if (!e) return resolve(null)
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return resolve(`${step.file} est introuvable sur cet ordinateur.`)
        // winget renvoie une erreur quand l'application est déjà là : on juge sur le résultat à la fin.
        resolve(String(stderr).trim().split(/\r?\n/).pop() || e.message)
      })
    )
    if (err && systemExe(app, platform) === null) return err
  }
  return systemExe(app, platform) === null ? 'L’installation s’est terminée mais l’application reste introuvable.' : null
}

/** Programme d'une application déjà installée sur l'ordinateur, ou null. (Un alias du Microsoft Store n'est pas un fichier ordinaire : on teste avec lstat.) */
export function systemExe(app: AppDef, platform: NodeJS.Platform = process.platform): string | null {
  for (const raw of app.system?.[platform] ?? []) {
    const p = raw
      .replace(/%APPDATA%/gi, process.env.APPDATA ?? '')
      .replace(/%LOCALAPPDATA%/gi, process.env.LOCALAPPDATA ?? '')
      .replace(/^~/, homedir())
    try {
      lstatSync(p)
      return p
    } catch {
      // absent à cet endroit : on essaie le suivant
    }
  }
  return null
}

export const appsRoot = (userData: string): string => join(userData, 'apps')

/** Cherche le programme dans le dossier de l'application (quelques niveaux, sans tenir compte des majuscules). */
export function findExe(dir: string, exe: string, depth = 3): string | null {
  if (!existsSync(dir)) return null
  const wanted = exe.toLowerCase()
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return null
  }
  for (const name of entries) if (name.toLowerCase() === wanted && statSync(join(dir, name)).isFile()) return join(dir, name)
  if (depth <= 0) return null
  for (const name of entries) {
    const full = join(dir, name)
    try {
      if (statSync(full).isDirectory()) {
        const hit = findExe(full, exe, depth - 1)
        if (hit) return hit
      }
    } catch {
      /* fichier illisible : on passe */
    }
  }
  return null
}

/** Programme livré avec le lanceur, s'il y en a un et qu'il est là. */
const bundledExe = (app: AppDef, bundledRoot: string): string | null => {
  const rel = app.bundled?.[process.platform]
  const p = rel ? join(bundledRoot, rel) : ''
  return p && existsSync(p) ? p : null
}

export function appInfo(app: AppDef, root: string, bundledRoot = ''): AppInfo {
  const supported = app.platforms.includes(process.platform)
  const bundled = supported && bundledExe(app, bundledRoot) !== null
  const exePath = supported ? findExe(join(root, app.id), app.exe) : null
  return {
    id: app.id,
    title: app.title,
    description: app.description,
    fileHint: app.fileHint,
    supported,
    installed: bundled || exePath !== null || (supported && systemExe(app) !== null),
    bundled,
    external: app.system !== undefined,
    canInstall: app.install?.[process.platform] !== undefined,
    note: supported ? app.note?.(homedir()) : undefined
  }
}

/** Chemin du programme à lancer. Le programme livré est copié hors du lanceur (lecture seule) et rendu exécutable. */
export function launchPath(app: AppDef, root: string, bundledRoot = ''): string | null {
  const src = bundledExe(app, bundledRoot)
  if (!src) return findExe(join(root, app.id), app.exe) ?? systemExe(app)
  const dest = join(root, app.id, basename(src))
  if (!existsSync(dest) || statSync(dest).size !== statSync(src).size) {
    mkdirSync(join(root, app.id), { recursive: true })
    copyFileSync(src, dest)
  }
  chmodSync(dest, 0o755)
  return dest
}

function unzip(zip: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = (err: Error | null): void => (err ? reject(err) : resolve())
    if (process.platform === 'win32') {
      // Chaque fichier de l'archive est vérifié avant tout : un chemin qui sortirait du dossier (« ..\ ») la fait refuser.
      const script = String.raw`Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = [IO.Path]::GetFullPath($env:CL_DEST).TrimEnd([char]92) + [char]92
$z = [IO.Compression.ZipFile]::OpenRead($env:CL_ZIP)
try {
  foreach ($e in $z.Entries) {
    $t = [IO.Path]::GetFullPath((Join-Path $root $e.FullName))
    if (-not $t.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) { throw 'Archive refusee : chemin dangereux ' + $e.FullName }
  }
  foreach ($e in $z.Entries) {
    $t = [IO.Path]::GetFullPath((Join-Path $root $e.FullName))
    if ($e.FullName.EndsWith('/')) { [void][IO.Directory]::CreateDirectory($t); continue }
    [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($t))
    [IO.Compression.ZipFileExtensions]::ExtractToFile($e, $t, $true)
  }
} finally { $z.Dispose() }`
      execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
        { env: { ...process.env, CL_ZIP: zip, CL_DEST: dest }, windowsHide: true },
        (err) => done(err)
      )
    } else {
      execFile('unzip', ['-o', '-q', zip, '-d', dest], (err) => done(err))
    }
  })
}

/** Installe l'application depuis le fichier téléchargé (un .zip à décompresser, ou le programme seul). */
export async function installApp(app: AppDef, root: string, source: string): Promise<string | null> {
  if (!app.platforms.includes(process.platform)) return 'Cette application n’existe pas pour ce système.'
  if (!existsSync(source)) return 'Fichier introuvable.'
  const dest = join(root, app.id)
  const ext = extname(source).toLowerCase()
  try {
    if (ext === '.zip') {
      mkdirSync(dest, { recursive: true })
      await unzip(source, dest)
    } else if (basename(source).toLowerCase() === app.exe.toLowerCase()) {
      mkdirSync(dest, { recursive: true })
      copyFileSync(source, join(dest, app.exe))
    } else {
      return `Choisis ${app.fileHint}.`
    }
  } catch (e) {
    return 'L’installation a échoué : ' + (e instanceof Error ? e.message : String(e))
  }
  return findExe(dest, app.exe) ? null : `Le programme ${app.exe} n’est pas dans ce fichier.`
}

export function removeApp(app: AppDef, root: string): void {
  rmSync(join(root, app.id), { recursive: true, force: true })
}

/** Linux : PKVault affiche sa fenêtre avec WebKitGTK ; sans lui, il s'arrête aussitôt et sans rien dire. */
export const WEBKIT_HELP =
  'Pokémon Home a besoin d’une bibliothèque Linux (WebKitGTK). Ouvre un terminal et tape : sudo apt install libwebkit2gtk-4.1-0 — puis réessaie.'

/** true si WebKitGTK 4.1 est installé, false s'il manque, null si on ne peut pas le savoir. */
export function hasWebkit(): Promise<boolean | null> {
  if (process.platform !== 'linux') return Promise.resolve(true)
  return new Promise((resolve) =>
    execFile('ldconfig', ['-p'], { timeout: 5000, maxBuffer: 8 << 20 }, (err, out) => {
      if (!err) return resolve(/libwebkit2gtk-4\.1\.so\.0/.test(String(out)))
      // `ldconfig` est dans /sbin, souvent absent du PATH d'un utilisateur : on regarde les dossiers habituels.
      const dirs = ['/usr/lib/x86_64-linux-gnu', '/usr/lib64', '/usr/lib', '/lib/x86_64-linux-gnu']
      resolve(dirs.some((d) => existsSync(join(d, 'libwebkit2gtk-4.1.so.0'))) ? true : null)
    })
  )
}

/**
 * Lance l'application à part et vérifie qu'elle tient : si elle s'arrête dans les secondes qui suivent, on renvoie
 * la raison (fin de son journal) au lieu de ne rien dire. Sa sortie va dans `log`, jamais dans un tube :
 * un tube fermé ferait planter le programme à sa première ligne.
 */
export async function startDetached(exe: string, log: string, waitMs = 4000): Promise<string | null> {
  if (process.platform === 'linux' && (await hasWebkit()) === false) return WEBKIT_HELP
  mkdirSync(dirname(log), { recursive: true })
  const fd = openSync(log, 'w')
  try {
    return await new Promise<string | null>((resolve) => {
      const child = spawn(exe, [], { cwd: dirname(exe), detached: true, stdio: ['ignore', fd, fd] })
      const timer = setTimeout(() => {
        child.unref()
        resolve(null)
      }, waitMs)
      const fail = (why: string): void => {
        clearTimeout(timer)
        let tail = ''
        try {
          tail = readFileSync(log, 'utf8').trim().split(/\r?\n/).slice(-3).join(' ').slice(-300)
        } catch {
          // Pas de journal lisible : on s'en tient à la raison.
        }
        resolve(`Le programme s’est arrêté (${why}).${tail ? ' ' + tail : ''}`)
      }
      child.once('error', (e) => fail(e.message))
      // Un lanceur qui se termine sans erreur (code 0) a simplement passé la main à l'application : c'est un succès.
      child.once('exit', (code, signal) => {
        if (code === 0) {
          clearTimeout(timer)
          resolve(null)
        } else fail(signal ?? `code ${code}`)
      })
    })
  } finally {
    closeSync(fd)
  }
}
