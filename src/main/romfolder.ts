import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'fs'
import { copyFile, rename, unlink } from 'fs/promises'
import { basename, extname, join } from 'path'
import type { EmulatedGame } from '../shared/types'
import { EMULATORS } from '../shared/emulators'
import { normalizeTitle } from './catalog'
import { cleanTitle } from './library'

/** Dossiers créés dans le dossier des jeux, un par console. */
export const ROM_SUBFOLDERS = ['Game Boy', 'Game Boy Color', 'Game Boy Advance', 'Nintendo DS', 'Nintendo 3DS']

/** Extension de fichier de jeu → émulateur livré avec le lanceur. */
const EXT_EMULATOR: Record<string, string> = {
  '.gb': 'mgba',
  '.gbc': 'mgba',
  '.gba': 'mgba',
  '.nds': 'melonds',
  '.3ds': 'azahar',
  '.cci': 'azahar',
  '.cxi': 'azahar'
}

/**
 * Titre de tuile reconnu d'après le nom du fichier (français ou anglais). Les motifs les plus précis
 * passent en premier : « Ultra Sun » avant « Sun », « Omega Ruby » avant « Ruby », etc.
 */
const POKEMON_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/ultra ?(sun|soleil)/, 'Pokémon Ultra-Soleil'],
  [/ultra ?(moon|lune)/, 'Pokémon Ultra-Lune'],
  [/(omega ?ruby|rubis ?omega)/, 'Pokémon Rubis Oméga'],
  [/(alpha ?sapphire|saphir ?alpha)/, 'Pokémon Saphir Alpha'],
  // « Black 2 », mais aussi le nom No-Intro « Black Version 2 ».
  [/(black|noire)( version)? ?2/, 'Pokémon Noire 2'],
  [/(white|blanche)( version)? ?2/, 'Pokémon Blanche 2'],
  [/heart ?gold/, 'Pokémon Or HeartGold'],
  [/soul ?silver/, 'Pokémon Argent SoulSilver'],
  [/(fire ?red|rouge ?feu)/, 'Pokémon Rouge Feu'],
  [/(leaf ?green|vert ?feuille)/, 'Pokémon Vert Feuille'],
  [/(emerald|emeraude)/, 'Pokémon Émeraude'],
  [/(platinum|platine)/, 'Pokémon Platine'],
  [/(diamond|diamant)/, 'Pokémon Diamant'],
  [/(pearl|perle)/, 'Pokémon Perle'],
  [/(black|noire)/, 'Pokémon Noire'],
  [/(white|blanche)/, 'Pokémon Blanche'],
  [/(sun|soleil)/, 'Pokémon Soleil'],
  [/(moon|lune)/, 'Pokémon Lune'],
  [/(sapphire|saphir)/, 'Pokémon Saphir'],
  [/(ruby|rubis)/, 'Pokémon Rubis'],
  [/(crystal|cristal)/, 'Pokémon Cristal'],
  [/(yellow|jaune)/, 'Pokémon Jaune'],
  [/(gold|version or\b)/, 'Pokémon Or'],
  [/(silver|argent)/, 'Pokémon Argent'],
  [/(blue|bleu)/, 'Pokémon Bleue'],
  [/(red|rouge)/, 'Pokémon Rouge'],
  [/^pokemon x$/, 'Pokémon X'],
  [/^pokemon y$/, 'Pokémon Y']
]

/**
 * Jeux Pokémon dérivés : leur nom contient souvent celui d'un jeu principal (« Mystery Dungeon - Red Rescue Team »,
 * « Pinball Ruby & Sapphire ») mais ce n'en est pas un. Ils gardent leur propre nom.
 */
const POKEMON_SPINOFF = /(mystery ?dungeon|donjon ?mystere|pinball|flipper|ranger|trozei|dash|conquest|rumble|picross|puzzle|snap|stadium|trading ?card|card ?game|colosseum|shuffle|typing|art ?academy|link|channel|tretta|play ?it|learn)/

/** Nom d'un fichier de jeu → titre de la tuile (Pokémon reconnus), sinon son nom nettoyé. */
export function titleForRom(fileName: string): string {
  const base = basename(fileName, extname(fileName))
  const plain = normalizeTitle(base) // sert à la détection « pokemon »
  const words = cleanTitle(base)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-–—:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (plain.includes('pokemon') && !POKEMON_SPINOFF.test(words)) {
    const hit = POKEMON_PATTERNS.find(([re]) => re.test(words))
    if (hit) return hit[1]
  }
  // Jeux non Pokémon que le lanceur connaît déjà (titre et jaquette livrés).
  if (/inazuma ?eleven ?3/.test(words)) return 'Inazuma Eleven 3 Feu Explosif'
  return cleanTitle(base)
}

/** Fichiers de jeu du dossier (sous-dossiers compris, trois niveaux au plus). */
export function listRoms(dir: string, depth = 3): string[] {
  if (!dir || !existsSync(dir)) return []
  const out: string[] = []
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (depth > 1) out.push(...listRoms(full, depth - 1))
      } else if (EXT_EMULATOR[extname(entry.name).toLowerCase()]) {
        out.push(full)
      }
    }
  } catch {
    // dossier illisible : on l'ignore
  }
  return out.sort((a, b) => a.localeCompare(b))
}

/**
 * Jeux déposés dans le dossier : un par titre, l'émulateur étant choisi d'après l'extension.
 * `emulatorPath` donne le programme livré (ou `undefined` s'il manque : le fichier est alors ignoré).
 */
export function romEntries(dir: string, emulatorPath: (id: string) => string | undefined): EmulatedGame[] {
  const seen = new Set<string>()
  const result: EmulatedGame[] = []
  for (const file of listRoms(dir)) {
    const emulatorId = EXT_EMULATOR[extname(file).toLowerCase()]
    const exe = emulatorId ? emulatorPath(emulatorId) : undefined
    const info = emulatorId ? EMULATORS[emulatorId] : undefined
    if (!exe || !info) continue
    const title = titleForRom(file)
    const key = normalizeTitle(title)
    if (seen.has(key)) continue
    seen.add(key)
    result.push({
      title,
      emulatorExe: exe,
      gameFile: file,
      args: info.args.split(' ').filter(Boolean),
      readyTitle: info.readyTitle
    })
  }
  return result
}

const README = `DOSSIER DES JEUX

Dépose ici tes fichiers de jeu (.gb, .gbc, .gba, .nds, .3ds). Le lanceur les trouve tout seul :
ils apparaissent dans le menu au prochain démarrage (ou après « Actualiser »).

- Mets chaque fichier dans le dossier de sa console, ou directement ici : peu importe.
- Un fichier compressé (.zip, .7z) doit d'abord être décompressé.
- N'utilise que des jeux copiés depuis tes propres cartouches ou consoles.
`

/** Crée le dossier des jeux, ses dossiers par console et un petit mode d'emploi (sans rien écraser). */
export function ensureRomFolder(dir: string): void {
  if (!dir) return
  try {
    mkdirSync(dir, { recursive: true })
    for (const sub of ROM_SUBFOLDERS) mkdirSync(join(dir, sub), { recursive: true })
    const readme = join(dir, 'LISEZMOI.txt')
    if (!existsSync(readme)) writeFileSync(readme, README, 'utf8')
  } catch {
    // dossier non créable (droits…) : tant pis, le lanceur fonctionne sans
  }
}

/** Dossier de console où ranger un fichier de jeu, d'après son extension. */
const EXT_FOLDER: Record<string, string> = {
  '.gb': 'Game Boy',
  '.gbc': 'Game Boy Color',
  '.gba': 'Game Boy Advance',
  '.nds': 'Nintendo DS',
  '.3ds': 'Nintendo 3DS',
  '.cci': 'Nintendo 3DS',
  '.cxi': 'Nintendo 3DS'
}

export const ROM_EXTENSIONS = Object.keys(EXT_FOLDER).map((e) => e.slice(1))

export interface AddRomsResult {
  /** Titres des jeux copiés dans le dossier des jeux. */
  added: string[]
  /** Fichiers refusés (ou copiés mais pas encore jouables), avec la raison en une phrase. */
  skipped: string[]
}

export interface AddRomsOptions {
  /** Titres déjà présents dans les jeux (ajoutés à la main) : un fichier du même titre n'apparaîtrait pas. */
  takenTitles?: string[]
  /** Dit si l'émulateur d'une console est là. Absent : on suppose qu'il l'est. */
  hasEmulator?: (emulatorId: string) => boolean
}

/** Fichiers d'un dossier glissé (sous-dossiers compris, trois niveaux au plus) : jeux et archives, pour signaler ces dernières. */
function filesIn(dir: string, depth = 3): string[] {
  const out: string[] = []
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (depth > 1) out.push(...filesIn(full, depth - 1))
      } else if (EXT_FOLDER[extname(entry.name).toLowerCase()] || ARCHIVES.includes(extname(entry.name).toLowerCase())) {
        out.push(full)
      }
    }
  } catch {
    // dossier illisible : on l'ignore
  }
  return out.sort((a, b) => a.localeCompare(b))
}

const ARCHIVES = ['.zip', '.7z', '.rar']

const isDir = (path: string): boolean => {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

/**
 * Copie des fichiers de jeu dans le dossier des jeux, rangés par console : l'utilisateur n'a rien d'autre à faire.
 * Un dossier glissé est parcouru. Un fichier déjà présent, d'un format inconnu ou dont le titre est déjà pris
 * est signalé, jamais écrasé. La copie passe par un fichier « .part » : un échec ne laisse pas de jeu à moitié copié.
 */
export async function addRoms(dir: string, files: string[], options: AddRomsOptions = {}): Promise<AddRomsResult> {
  const result: AddRomsResult = { added: [], skipped: [] }
  ensureRomFolder(dir)
  // Titres déjà affichés : ceux du dossier des jeux et ceux ajoutés à la main.
  const taken = new Set([...listRoms(dir).map((f) => normalizeTitle(titleForRom(f))), ...(options.takenTitles ?? []).map(normalizeTitle)])
  const expanded: string[] = []
  for (const file of files) {
    if (!isDir(file)) {
      expanded.push(file)
      continue
    }
    const inside = filesIn(file)
    if (inside.length) expanded.push(...inside)
    else result.skipped.push(`${basename(file)} : aucun jeu trouvé dans ce dossier`)
  }
  for (const file of expanded) {
    const name = basename(file)
    const ext = extname(name).toLowerCase()
    const folder = EXT_FOLDER[ext]
    if (!folder) {
      result.skipped.push(
        ARCHIVES.includes(ext)
          ? `${name} : fichier compressé, décompresse-le d’abord`
          : `${name} : format non reconnu (.gb, .gbc, .gba, .nds, .3ds attendus)`
      )
      continue
    }
    const target = join(dir, folder, name)
    if (existsSync(target)) {
      result.skipped.push(`${name} : déjà dans le dossier des jeux`)
      continue
    }
    const title = titleForRom(name)
    const key = normalizeTitle(title)
    if (taken.has(key)) {
      result.skipped.push(`${name} : « ${title} » est déjà dans tes jeux`)
      continue
    }
    const part = target + '.part'
    try {
      await copyFile(file, part)
      await rename(part, target)
    } catch {
      await unlink(part).catch(() => undefined)
      result.skipped.push(`${name} : copie impossible (disque plein ou fichier illisible ?)`)
      continue
    }
    taken.add(key)
    const emulatorId = EXT_EMULATOR[ext]
    if (options.hasEmulator && !options.hasEmulator(emulatorId)) {
      const emu = EMULATORS[emulatorId]
      result.skipped.push(`${title} : copié, mais l’émulateur ${emu?.name ?? emulatorId} (${emu?.consoles ?? folder}) manque : le jeu apparaîtra une fois l’émulateur installé`)
      continue
    }
    result.added.push(title)
  }
  return result
}
