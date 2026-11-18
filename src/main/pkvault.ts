import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'

/**
 * Pokémon Home (PKVault) ne trouve une sauvegarde que dans les dossiers de ses réglages (SAVE_GLOBS).
 * Avant chaque lancement, le lanceur y ajoute tous les endroits où ses émulateurs rangent les sauvegardes :
 * l'utilisateur n'a rien à indiquer.
 */

/** Dossier des sauvegardes de la 3DS dans Azahar (créé au premier lancement d'un jeu 3DS). */
export function azaharSdmc(home: string, platform: NodeJS.Platform = process.platform, appdata = process.env.APPDATA): string {
  return platform === 'win32' ? join(appdata ?? join(home, 'AppData', 'Roaming'), 'Azahar', 'sdmc') : join(home, '.local/share/azahar-emu/sdmc')
}

/**
 * Dossier de données de PKVault : sous Windows à côté du programme. Sous Linux, PKVault prend sinon ~/Documents/pkvault
 * (ou $XDG_DATA_HOME) : le lanceur lui impose ce dossier par la variable PKVAULT_PATH, pour qu'il lise les réglages écrits ici.
 */
export function pkvaultDir(exe: string, platform: NodeJS.Platform = process.platform): string {
  return platform === 'win32' ? dirname(exe) : join(dirname(exe), 'pkvault')
}

export function pkvaultSettingsFile(exe: string, platform: NodeJS.Platform = process.platform): string {
  return join(pkvaultDir(exe, platform), 'config', 'pkvault.json')
}

/** Dossier « Documents » de Linux (~/.config/user-dirs.dirs), où PKVault rangeait ses données avant PKVAULT_PATH. */
export function linuxDocumentsDir(home: string): string {
  try {
    const line = /^XDG_DOCUMENTS_DIR="(.*)"$/m.exec(readFileSync(join(home, '.config', 'user-dirs.dirs'), 'utf8'))?.[1]
    if (line) return line.replace(/^\$HOME/, home)
  } catch {
    // pas de fichier : dossier par défaut
  }
  return join(home, 'Documents')
}

/**
 * Linux : les Pokémon déjà rangés dans l'ancien dossier de PKVault (~/Documents/pkvault) sont recopiés une fois
 * dans le dossier du lanceur. Copie seulement (l'ancien dossier reste intact), et jamais par-dessus des données existantes.
 */
export function adoptOldPkvaultData(oldDir: string, newDir: string): boolean {
  if (existsSync(join(newDir, 'db')) || !existsSync(join(oldDir, 'db'))) return false
  cpSync(oldDir, newDir, { recursive: true, force: false, errorOnExist: false })
  return true
}

const slashed = (p: string): string => p.replace(/\\/g, '/').replace(/\/+$/, '')

/** Modèles de fichiers à surveiller : jeux rétro (mGBA, melonDS) dans le dossier des jeux, jeux 3DS dans Azahar. */
export function saveGlobs(romsDir: string, sdmcDir: string, gameDirs: string[] = []): string[] {
  const globs: string[] = []
  if (romsDir) globs.push(`${slashed(romsDir)}/**/*.sav`, `${slashed(romsDir)}/**/*.dsv`)
  if (sdmcDir) globs.push(`${slashed(sdmcDir)}/**/data/00000001/main`)
  // Jeux ajoutés depuis un autre dossier : l'émulateur range leur sauvegarde à côté du fichier de jeu.
  for (const dir of new Set(gameDirs.filter(Boolean).map(slashed))) globs.push(`${dir}/*.sav`, `${dir}/*.dsv`, `${dir}/*.srm`)
  return globs
}

/** Réglages par défaut de PKVault : un fichier incomplet le fait refuser de démarrer, il faut donc tous les champs. */
const DEFAULTS = {
  DB_PATH: './db',
  SAVE_GLOBS: ['./pokemon-emerald-sample.sav'],
  PKM_EXTERNAL_GLOBS: [] as string[],
  STORAGE_PATH: './storage',
  BACKUP_PATH: './backup',
  HIDE_CHEATS: false,
  SKIP_LEGALITY_CHECKS: false,
  LANGUAGE: 'en'
}

/**
 * Ajoute `globs` aux sauvegardes connues de PKVault, sans rien retirer de ce que l'utilisateur y a mis.
 * Un fichier de réglages illisible n'est pas touché. Renvoie true si le fichier a été écrit.
 */
export function addSaveGlobs(file: string, globs: string[]): boolean {
  let settings: Record<string, unknown> = { ...DEFAULTS }
  if (existsSync(file)) {
    try {
      const raw = JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
      settings = raw as Record<string, unknown>
    } catch {
      return false
    }
  }
  const known = Array.isArray(settings.SAVE_GLOBS) ? settings.SAVE_GLOBS.filter((g): g is string => typeof g === 'string') : []
  const missing = globs.filter((g) => !known.includes(g))
  if (missing.length === 0 && existsSync(file)) return false
  settings.SAVE_GLOBS = [...known, ...missing]
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(`${file}.tmp`, JSON.stringify(settings, null, 2), 'utf8')
  renameSync(`${file}.tmp`, file)
  return true
}
