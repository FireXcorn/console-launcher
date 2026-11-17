import { existsSync } from 'fs'
import { join } from 'path'

/**
 * Exclusivités Nintendo Switch 2 (titres seulement, d'après le guide Nintendo Life consulté le
 * 12/11/2026). Ni jaquettes ni extraits : ce sont des entrées « cartouche non insérée ».
 * L'extension de contenu « Pokémon Pokopia Expansion Pass » n'est pas un jeu et est exclue.
 * Notre Zelda Ocarina of Time est installé : il n'a pas besoin d'entrée ici.
 */
const EXCLUSIVES: ReadonlyArray<readonly [title: string, date: string]> = [
  ['Kirby Air Riders', '2025-11-20'],
  ['Pokémon Pokopia', '2026-03-05'],
  ['Yoshi and the Mysterious Book', '2026-05-21'],
  ['Star Fox', '2026-06-25'],
  ['Splatoon Raiders', '2026-07-23']
]
/** Jeux mis en avant, dans l'ordre voulu par l'utilisateur ; les autres suivent par date de sortie. */
const FEATURED = [
  'Kirby Air Riders',
  'Pokémon Pokopia',
  'Yoshi and the Mysterious Book',
  'Splatoon Raiders'
]

export interface CatalogEntry {
  id: string
  title: string
}

/**
 * Jeux Pokémon (Game Boy à 3DS), avec l'émulateur conseillé pour chacun, du plus récent au plus ancien
 * (Ultra-Soleil en premier). Pas de jeux Switch : aucun émulateur Switch n'est livré.
 */
const POKEMON: ReadonlyArray<readonly [title: string, emulator: string]> = [
  ['Pokémon Ultra-Soleil', 'azahar'],
  ['Pokémon Ultra-Lune', 'azahar'],
  ['Pokémon Soleil', 'azahar'],
  ['Pokémon Lune', 'azahar'],
  ['Pokémon Rubis Oméga', 'azahar'],
  ['Pokémon Saphir Alpha', 'azahar'],
  ['Pokémon X', 'azahar'],
  ['Pokémon Y', 'azahar'],
  ['Pokémon Noire 2', 'melonds'],
  ['Pokémon Blanche 2', 'melonds'],
  ['Pokémon Noire', 'melonds'],
  ['Pokémon Blanche', 'melonds'],
  ['Pokémon Or HeartGold', 'melonds'],
  ['Pokémon Argent SoulSilver', 'melonds'],
  ['Pokémon Platine', 'melonds'],
  ['Pokémon Diamant', 'melonds'],
  ['Pokémon Perle', 'melonds'],
  ['Pokémon Émeraude', 'mgba'],
  ['Pokémon Rouge Feu', 'mgba'],
  ['Pokémon Vert Feuille', 'mgba'],
  ['Pokémon Rubis', 'mgba'],
  ['Pokémon Saphir', 'mgba'],
  ['Pokémon Cristal', 'mgba'],
  ['Pokémon Or', 'mgba'],
  ['Pokémon Argent', 'mgba'],
  ['Pokémon Jaune', 'mgba'],
  ['Pokémon Rouge', 'mgba'],
  ['Pokémon Bleue', 'mgba']
]

export interface PokemonEntry extends CatalogEntry {
  emulatorId?: string
}

/** Rang d'un jeu Pokémon dans le catalogue (ordre d'affichage voulu), ou -1 si ce n'est pas un jeu Pokémon du catalogue. */
export function pokemonRank(title: string): number {
  const n = normalizeTitle(title)
  return POKEMON.findIndex(([t]) => normalizeTitle(t) === n)
}

const GBA_TITLES = ['Pokémon Émeraude', 'Pokémon Rouge Feu', 'Pokémon Vert Feuille', 'Pokémon Rubis', 'Pokémon Saphir'].map(normalizeTitle)

/** Console d'origine d'un jeu Pokémon du catalogue (sert à ranger l'écran « Pokémon »), ou null si ce n'en est pas un. */
export function pokemonConsole(title: string): string | null {
  const rank = pokemonRank(title)
  if (rank === -1) return null
  const emulator = POKEMON[rank][1]
  if (emulator === 'azahar') return 'Nintendo 3DS'
  if (emulator === 'melonds') return 'Nintendo DS'
  return GBA_TITLES.includes(normalizeTitle(title)) ? 'Game Boy Advance' : 'Game Boy et Game Boy Color'
}

/** Jeux Pokémon absents de la bibliothèque (un jeu ajouté sous le même titre remplace la tuile). */
export function pokemonEntries(installedTitles: string[]): PokemonEntry[] {
  const installed = installedTitles.map(normalizeTitle)
  return POKEMON.filter(([title]) => {
    const n = normalizeTitle(title)
    return !installed.some((i) => i === n)
  }).map(([title, emulatorId]) => ({ id: catalogId(title), title, emulatorId: emulatorId || undefined }))
}

/** Minuscules, sans accents ni ponctuation : sert à comparer des titres. */
export function normalizeTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '')
}

export function catalogId(title: string): string {
  return `catalog:${normalizeTitle(title)}`
}

/** Entrées du catalogue absentes de la bibliothèque, dans l'ordre de sortie. */
export function missingEntries(installedTitles: string[]): CatalogEntry[] {
  const installed = installedTitles.map(normalizeTitle)
  const rank = (title: string): number => {
    const i = FEATURED.indexOf(title)
    return i === -1 ? FEATURED.length : i
  }
  return [...EXCLUSIVES]
    .sort((a, b) => rank(a[0]) - rank(b[0]) || a[1].localeCompare(b[1]))
    .filter(([title]) => {
      const n = normalizeTitle(title)
      return !installed.some((i) => i === n || (n.length >= 8 && i.includes(n)))
    })
    .map(([title]) => ({ id: catalogId(title), title }))
}

const COVER_EXTS = ['.png', '.jpg', '.jpeg', '.webp']
const BACKDROP_EXTS = [...COVER_EXTS, '.avif']

/** Jaquette déposée par l'utilisateur : `<dossier>\<titre>.png` (ou titre simplifié). */
export function findCover(dir: string, title: string, exts: readonly string[] = COVER_EXTS): string | null {
  if (!dir) return null
  const bases = [title.replace(/[<>:"/\\|?*]/g, ''), normalizeTitle(title)]
  for (const base of bases) {
    for (const ext of exts) {
      const path = join(dir, base + ext)
      if (existsSync(path)) return path
    }
  }
  return null
}

/** Grande image de fond d'un jeu : <dossier des fonds>\<titre>.jpg (png, jpg, webp ou avif). */
export function findBackdrop(dir: string, title: string): string | null {
  return findCover(dir, title, BACKDROP_EXTS)
}
