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
