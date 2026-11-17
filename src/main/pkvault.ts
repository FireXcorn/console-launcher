import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
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

/** Fichier de réglages de PKVault : sous Windows à côté du programme, sous Linux dans le sous-dossier « pkvault » de son dossier de travail. */
export function pkvaultSettingsFile(exe: string, platform: NodeJS.Platform = process.platform): string {
  return platform === 'win32' ? join(dirname(exe), 'config', 'pkvault.json') : join(dirname(exe), 'pkvault', 'config', 'pkvault.json')
}

const slashed = (p: string): string => p.replace(/\\/g, '/').replace(/\/+$/, '')

/** Modèles de fichiers à surveiller : jeux rétro (mGBA, melonDS) dans le dossier des jeux, jeux 3DS dans Azahar. */
export function saveGlobs(romsDir: string, sdmcDir: string): string[] {
  const globs: string[] = []
  if (romsDir) globs.push(`${slashed(romsDir)}/**/*.sav`, `${slashed(romsDir)}/**/*.dsv`)
  if (sdmcDir) globs.push(`${slashed(sdmcDir)}/**/data/00000001/main`)
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
