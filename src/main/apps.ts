import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'fs'
import { homedir } from 'os'
import { basename, extname, join } from 'path'
import { execFile } from 'child_process'
import type { AppInfo } from '../shared/types'

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
    note: (home) =>
      `Jeux 3DS : dans les réglages de PKVault, ajoute le dossier de sauvegardes d’Azahar : ${
        process.platform === 'win32' ? join(process.env.APPDATA ?? join(home, 'AppData', 'Roaming'), 'Azahar', 'sdmc') : join(home, '.local/share/azahar-emu/sdmc')
      } (créé au premier lancement d’un jeu 3DS).`
  }
]

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
    installed: bundled || exePath !== null,
    bundled,
    note: supported ? app.note?.(homedir()) : undefined
  }
}

/** Chemin du programme à lancer. Le programme livré est copié hors du lanceur (lecture seule) et rendu exécutable. */
export function launchPath(app: AppDef, root: string, bundledRoot = ''): string | null {
  const src = bundledExe(app, bundledRoot)
  if (!src) return findExe(join(root, app.id), app.exe)
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
      const q = (s: string): string => "'" + s.replace(/'/g, "''") + "'"
      execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', `Expand-Archive -LiteralPath ${q(zip)} -DestinationPath ${q(dest)} -Force`],
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
