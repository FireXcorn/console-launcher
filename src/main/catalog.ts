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
 * Jeux Pokémon (Game Boy à 3DS), avec l'émulateur conseillé pour chacun. Aucune Switch : ces jeux
 * s'ajoutent soi-même (Paramètres → Ajouter des jeux) avec un émulateur que l'utilisateur télécharge.
 */
const POKEMON: ReadonlyArray<readonly [title: string, emulator: string]> = [
  ['Pokémon Rouge et Bleu (et Vert)', 'mgba'],
  ['Pokémon Jaune', 'mgba'],
  ['Pokémon Or et Argent', 'mgba'],
  ['Pokémon Cristal', 'mgba'],
  ['Pokémon Rubis et Saphir', 'mgba'],
  ['Pokémon Rouge Feu et Vert Feuille', 'mgba'],
  ['Pokémon Émeraude', 'mgba'],
  ['Pokémon XD : Le Souffle des Ténèbres', 'dolphin'],
  ['Pokémon Ranger', 'melonds'],
  ['Pokémon Diamant et Perle', 'melonds'],
  ['Pokémon Platine', 'melonds'],
  ['Pokémon Or HeartGold et Argent SoulSilver', 'melonds'],
  ['Pokémon Noire et Blanche', 'melonds'],
  ['Pokémon Noire 2 et Blanche 2', 'melonds'],
  ['Pokémon X et Y', 'azahar'],
  ['Pokémon Rubis Oméga et Saphir Alpha', 'azahar'],
  ['Pokémon Soleil et Lune', 'azahar'],
  ['Pokémon Ultra-Soleil et Ultra-Lune', 'azahar']
]

export interface PokemonEntry extends CatalogEntry {
  emulatorId: string
}

/** Jeux Pokémon absents de la bibliothèque (un jeu ajouté sous le même titre remplace la tuile). */
export function pokemonEntries(installedTitles: string[]): PokemonEntry[] {
  const installed = installedTitles.map(normalizeTitle)
  return POKEMON.filter(([title]) => {
    const n = normalizeTitle(title)
    return !installed.some((i) => i === n)
  }).map(([title, emulatorId]) => ({ id: catalogId(title), title, emulatorId }))
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
