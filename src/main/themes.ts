import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { extname, join } from 'path'
import {
  type Theme,
  BUILTIN_THEMES,
  isBuiltinTheme,
  isThemeId,
  normalizeTheme,
  safeWallpaperName,
  themeSlug
} from '../shared/theme'

const MAX_JSON_BYTES = 64 * 1024
export const MAX_WALLPAPER_BYTES = 15 * 1024 * 1024
const MAX_SOUND_BYTES = 30 * 1024 * 1024
const SOUND_EXT = /\.(mp3|ogg|wav|flac|m4a)$/i
const SOUND_NAMES = ['menu', 'deplacer', 'valider', 'retour', 'lancer', 'refuser']

export function themeFolder(root: string, id: string): string | null {
  return isThemeId(id) ? join(root, id) : null
}

/** Lit un `theme.json` (taille bornée) ; null s'il manque ou est illisible. */
function readThemeFile(folder: string, id: string): Theme | null {
  const file = join(folder, 'theme.json')
  try {
    if (!existsSync(file) || statSync(file).size > MAX_JSON_BYTES) return null
    return normalizeTheme(JSON.parse(readFileSync(file, 'utf8')), id)
  } catch {
    return null
  }
}

/** Thèmes de l'utilisateur : un sous-dossier de `root` par thème. */
export function listThemes(root: string): Theme[] {
  let names: string[]
  try {
    names = readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && isThemeId(d.name))
      .map((d) => d.name)
  } catch {
    return []
  }
  return names.flatMap((name) => {
    const theme = readThemeFile(join(root, name), name)
    return theme ? [theme] : []
  })
}

/** Chemin du fond d'écran d'un thème, ou null (absent, trop lourd, nom invalide). */
export function wallpaperPath(root: string, theme: Theme): string | null {
  const folder = themeFolder(root, theme.id)
  const name = safeWallpaperName(theme.wallpaper)
  if (!folder || !name) return null
  const file = join(folder, name)
  try {
    return statSync(file).isFile() && statSync(file).size <= MAX_WALLPAPER_BYTES ? file : null
  } catch {
    return null
  }
}

export function soundsFolder(root: string, id: string): string | null {
  const folder = themeFolder(root, id)
  return folder ? join(folder, 'sounds') : null
}

/** Premier identifiant libre : `nom`, `nom-2`, `nom-3`… (jamais celui d'un thème fourni). */
export function freeThemeId(root: string, name: string): string {
  const slug = themeSlug(name)
  let id = slug
  for (let n = 2; isBuiltinTheme(id) || existsSync(join(root, id)); n += 1) id = `${slug}-${n}`.slice(0, 40)
  return id
}

/**
 * Enregistre un thème. Un thème fourni (ou sans identifiant valable) devient une copie sous un nouveau
 * nom ; `wallpaperSource` est copié dans le dossier du thème sous un nom simple.
 */
export function saveTheme(root: string, input: Theme, wallpaperSource?: string): Theme {
  const existing = isThemeId(input.id) && !isBuiltinTheme(input.id) && existsSync(join(root, input.id))
  const id = existing ? input.id : freeThemeId(root, input.name || 'theme')
  const folder = join(root, id)
  mkdirSync(folder, { recursive: true })
  let wallpaper = safeWallpaperName(input.wallpaper)
  if (wallpaperSource && existsSync(wallpaperSource) && statSync(wallpaperSource).size <= MAX_WALLPAPER_BYTES) {
    const ext = extname(wallpaperSource).toLowerCase()
    const name = safeWallpaperName(`wallpaper${ext}`)
    if (name) {
      copyFileSync(wallpaperSource, join(folder, name))
      wallpaper = name
    }
  } else if (wallpaper && !existsSync(join(folder, wallpaper))) {
    // Copie d'un thème dont le fond est dans un autre dossier : on ne le suppose pas ici.
    wallpaper = ''
  }
  const theme = normalizeTheme({ ...input, wallpaper }, id)
  writeFileSync(join(folder, 'theme.json'), JSON.stringify(stripId(theme), null, 2), 'utf8')
  return theme
}

function stripId(theme: Theme): Omit<Theme, 'id'> {
  const { id: _id, ...rest } = theme
  return rest
}

/**
 * Importe un dossier de thème choisi par l'utilisateur : `theme.json`, l'image de fond et les sons
 * reconnus sont copiés (rien d'autre). Renvoie le thème importé, ou null s'il n'y a pas de `theme.json`.
 */
export function importTheme(root: string, source: string): Theme | null {
  const parsed = readThemeFile(source, 'import')
  if (!parsed) return null
  const id = freeThemeId(root, parsed.name)
  const folder = join(root, id)
  mkdirSync(folder, { recursive: true })
  const wallpaper = safeWallpaperName(parsed.wallpaper)
  let kept = ''
  if (wallpaper) {
    const from = join(source, wallpaper)
    try {
      if (statSync(from).isFile() && statSync(from).size <= MAX_WALLPAPER_BYTES) {
        copyFileSync(from, join(folder, wallpaper))
        kept = wallpaper
      }
    } catch {
      // Image absente : le thème s'importe sans fond.
    }
  }
  const sounds = join(source, 'sounds')
  try {
    for (const entry of readdirSync(sounds, { withFileTypes: true })) {
      const base = entry.name.replace(/\.[^.]+$/, '')
      if (!entry.isFile() || !SOUND_EXT.test(entry.name) || !SOUND_NAMES.includes(base)) continue
      if (statSync(join(sounds, entry.name)).size > MAX_SOUND_BYTES) continue
      mkdirSync(join(folder, 'sounds'), { recursive: true })
      copyFileSync(join(sounds, entry.name), join(folder, 'sounds', entry.name))
    }
  } catch {
    // Pas de dossier de sons : rien à copier.
  }
  const theme = normalizeTheme({ ...parsed, wallpaper: kept }, id)
  writeFileSync(join(folder, 'theme.json'), JSON.stringify(stripId(theme), null, 2), 'utf8')
  return theme
}

export { BUILTIN_THEMES }
