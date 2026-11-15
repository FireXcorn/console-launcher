import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'fs'
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
  [/(black ?2|noire ?2)/, 'Pokémon Noire 2'],
  [/(white ?2|blanche ?2)/, 'Pokémon Blanche 2'],
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
  [/ranger/, 'Pokémon Ranger'],
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
  if (plain.includes('pokemon')) {
    const hit = POKEMON_PATTERNS.find(([re]) => re.test(words))
    if (hit) return hit[1]
  }
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
