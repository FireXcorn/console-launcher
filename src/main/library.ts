import { existsSync } from 'fs'
import { readdir } from 'fs/promises'
import { basename, dirname, join } from 'path'
import type { Config } from '../shared/types'
import { normalizeTitle } from './catalog'
import type { EmulatorWatch } from './launcher'

/** Jeu tel que trouvé sur le disque ; `iconPath` est un chemin, pas une URL. */
export interface ScannedGame {
  id: string
  title: string
  /** Dossier de travail ; pour un jeu émulé, celui de l'émulateur (ses processus y sont suivis). */
  dir: string
  exe: string
  args: string[]
  iconPath: string | null
  lastPlayed: number
  /** Chemin complet du programme à lancer, quand il n'est pas dans `dir` sous le nom `exe`. */
  exePath?: string
  /** Vrai pour un jeu lancé par un émulateur. */
  emulated?: boolean
  /** Titre d'origine de l'entrée dans la configuration (pour la retrouver malgré un renommage). */
  sourceTitle?: string
  /** Suivi du chargement d'un jeu émulé (écran noir, questions, signal « le jeu tourne »). */
  watch?: EmulatorWatch
}

/** Titre à plusieurs « | » : celui qu'affichent les émulateurs de cette famille une fois le jeu lancé. */
export const DEFAULT_READY_TITLE = '\\|.+\\|.+\\|'
/** Questions auxquelles le lanceur répond « oui » : paramètres recommandés, plein écran. */
export const DEFAULT_DIALOG_PATTERN = '(?i)recommended|recommand|fullscreen|plein .cran'
/** Temps laissé au jeu pour s'afficher après le signal « il tourne », avant de retirer l'écran noir. */
export const DEFAULT_SETTLE_MS = 5000

export function emulatedId(title: string): string {
  return `emu:${normalizeTitle(title)}`
}

const ICON_NAMES = ['icon', 'cover', 'banner']
const ICON_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.ico']

export function gameId(dir: string): string {
  return dir.replace(/[\\/]+$/, '').toLowerCase()
}

export function cleanTitle(name: string): string {
  return name
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .replace(/[_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || name
}

export function buildArgs(template: string[], dir: string): string[] {
  return template.map((a) => a.split('{dir}').join(dir))
}

function findIcon(dir: string): string | null {
  for (const name of ICON_NAMES) {
    for (const ext of ICON_EXTS) {
      const p = join(dir, name + ext)
      if (existsSync(p)) return p
    }
  }
  return null
}

type ScanConfig = Pick<Config, 'gamesDir' | 'launchExe' | 'launchArgs' | 'overrides' | 'lastPlayed'> & {
  emulated?: Config['emulated']
}

/** Jeux lancés par un émulateur : présents seulement si l'émulateur et le fichier du jeu existent. */
function emulatedGames(cfg: ScanConfig): ScannedGame[] {
  const games: ScannedGame[] = []
  for (const e of cfg.emulated ?? []) {
    if (!e.title?.trim() || !e.emulatorExe || !existsSync(e.emulatorExe)) continue
    // Un programme lancé seul (jeu recompilé) n'a pas de fichier de jeu ; s'il y en a un, il doit exister.
    if (e.gameFile ? !existsSync(e.gameFile) : e.args.some((a) => a.includes('{game}'))) continue
    const id = emulatedId(e.title)
    const ov = cfg.overrides[id] ?? {}
    games.push({
      id,
      title: ov.title?.trim() || e.title.trim(),
      dir: dirname(e.emulatorExe),
      exe: basename(e.emulatorExe),
      exePath: e.emulatorExe,
      args: e.args.map((a) => a.split('{game}').join(e.gameFile)),
      iconPath: ov.icon && existsSync(ov.icon) ? ov.icon : null,
      lastPlayed: cfg.lastPlayed[id] ?? 0,
      emulated: true,
      sourceTitle: e.title.trim(),
      watch: {
        // Avec un journal d'émulateur, le titre de la fenêtre ne sert que s'il est demandé expressément :
        // un titre qui change pendant le chargement ferait retirer l'écran noir trop tôt.
        readyTitle: e.readyTitle?.trim() || (e.readyLog ? '' : DEFAULT_READY_TITLE),
        readyLog: e.readyLog?.trim() || '',
        readyPattern: e.readyPattern?.trim() || '',
        settleMs: e.settleMs ?? DEFAULT_SETTLE_MS,
        dialogPattern: e.dialogPattern?.trim() || DEFAULT_DIALOG_PATTERN
      }
    })
  }
  return games
}

export async function scanLibrary(cfg: ScanConfig): Promise<ScannedGame[]> {
  const games: ScannedGame[] = await scanFolder(cfg)
  games.push(...emulatedGames(cfg))
  return games.sort((a, b) => b.lastPlayed - a.lastPlayed || a.title.localeCompare(b.title))
}

async function scanFolder(cfg: ScanConfig): Promise<ScannedGame[]> {
  if (!cfg.gamesDir || !cfg.launchExe || !existsSync(cfg.gamesDir)) return []

  const candidates = [cfg.gamesDir]
  const entries = await readdir(cfg.gamesDir, { withFileTypes: true })
  for (const e of entries) {
    if (e.isDirectory()) candidates.push(join(cfg.gamesDir, e.name))
  }

  const games: ScannedGame[] = []
  for (const dir of candidates) {
    if (!existsSync(join(dir, cfg.launchExe))) continue
    const id = gameId(dir)
    const ov = cfg.overrides[id] ?? {}
    const icon = ov.icon && existsSync(ov.icon) ? ov.icon : findIcon(dir)
    games.push({
      id,
      title: ov.title?.trim() || cleanTitle(basename(dir)),
      dir,
      exe: cfg.launchExe,
      args: buildArgs(cfg.launchArgs, dir),
      iconPath: icon,
      lastPlayed: cfg.lastPlayed[id] ?? 0
    })
  }
  return games
}
