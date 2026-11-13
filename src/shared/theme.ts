/**
 * Thèmes du menu : fond d'écran, couleurs, forme des tuiles, style de la barre et du curseur, sons.
 * Même idée que les thèmes personnalisés de la Switch 1 (homebrew), mais appliquée à ce lanceur :
 * un thème est un dossier `themes/<id>/` contenant `theme.json`, une image de fond et un dossier `sounds/`.
 */

export const COLOR_KEYS = ['bg', 'surface', 'slot', 'bar', 'icon', 'text', 'accent'] as const
export type ColorKey = (typeof COLOR_KEYS)[number]

export const COLOR_LABELS: Record<ColorKey, string> = {
  bg: 'Fond',
  surface: 'Panneaux',
  slot: 'Cases vides',
  bar: 'Barre du bas',
  icon: 'Icônes',
  text: 'Texte',
  accent: 'Accent'
}

export interface Theme {
  id: string
  name: string
  author: string
  /** Jeu de couleurs de départ ; `colors` ne remplace que ce qui est précisé. */
  base: 'light' | 'dark'
  colors: Partial<Record<ColorKey, string>>
  /** Nom du fichier image dans le dossier du thème (jamais un chemin), ou vide. */
  wallpaper: string
  /** Voile sombre posé sur le fond d'écran pour garder le texte lisible (0 à 0,7). */
  wallpaperDim: number
  /** Arrondi des tuiles, en unités d'interface (0 = carré, 3 = très rond). */
  tileRadius: number
  dockStyle: 'bar' | 'floating'
  dockColors: 'color' | 'mono'
  cursor: 'iridescent' | 'solid'
  /** Utiliser le dossier `sounds/` du thème avant celui des réglages. */
  sounds: boolean
}

export const DEFAULT_THEME_ID = 'clair'

const HEX = /^#[0-9a-f]{6}$/i
const WALLPAPER_EXT = /\.(png|jpe?g|webp|avif|gif)$/i

export function themeSlug(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return slug || 'theme'
}

/** Identifiant valable pour un nom de dossier : lettres, chiffres et tirets seulement. */
export function isThemeId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,39}$/.test(value)
}

/** Nom de fichier simple (pas de dossier, extension d'image) ou chaîne vide. */
export function safeWallpaperName(value: unknown): string {
  if (typeof value !== 'string') return ''
  if (value.includes('/') || value.includes('\\') || value.includes('..') || value.includes(':')) return ''
  return WALLPAPER_EXT.test(value) && value.length <= 80 ? value : ''
}

const clamp = (n: unknown, min: number, max: number, fallback: number): number =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback

/** Remet un thème (lu d'un fichier, donc non fiable) dans une forme sûre. */
export function normalizeTheme(raw: unknown, id: string): Theme {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const colors: Partial<Record<ColorKey, string>> = {}
  const input = (r.colors && typeof r.colors === 'object' ? r.colors : {}) as Record<string, unknown>
  for (const key of COLOR_KEYS) {
    const v = input[key]
    if (typeof v === 'string' && HEX.test(v)) colors[key] = v.toLowerCase()
  }
  return {
    id,
    name: typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 40) : id,
    author: typeof r.author === 'string' ? r.author.trim().slice(0, 40) : '',
    base: r.base === 'dark' ? 'dark' : 'light',
    colors,
    wallpaper: safeWallpaperName(r.wallpaper),
    wallpaperDim: clamp(r.wallpaperDim, 0, 0.7, 0),
    tileRadius: clamp(r.tileRadius, 0, 3, 1),
    dockStyle: r.dockStyle === 'floating' ? 'floating' : 'bar',
    dockColors: r.dockColors === 'mono' ? 'mono' : 'color',
    cursor: r.cursor === 'solid' ? 'solid' : 'iridescent',
    sounds: r.sounds === true
  }
}

const base = (id: string, name: string, over: Partial<Theme>): Theme => ({
  ...normalizeTheme({}, id),
  name,
  author: 'Console Launcher',
  ...over
})

/** Thèmes fournis avec le lanceur (originaux). Ils ne se suppriment pas : on les copie pour les modifier. */
export const BUILTIN_THEMES: Theme[] = [
  base('clair', 'Clair', { base: 'light' }),
  base('sombre', 'Sombre', { base: 'dark' }),
  base('minuit', 'Minuit', {
    base: 'dark',
    colors: { bg: '#12172b', surface: '#1d2440', slot: '#181e36', bar: '#1b2140', icon: '#b8c4ff', text: '#eef1ff', accent: '#7c9cff' },
    tileRadius: 1.6,
    dockStyle: 'floating'
  }),
  base('sakura', 'Sakura', {
    base: 'light',
    colors: { bg: '#fbeff2', surface: '#ffffff', slot: '#fff6f8', bar: '#fff3f6', icon: '#a05a6e', text: '#4a2c36', accent: '#e0507a' },
    tileRadius: 2.2,
    dockColors: 'mono'
  }),
  base('foret', 'Forêt', {
    base: 'light',
    colors: { bg: '#e9efe6', surface: '#ffffff', slot: '#f3f8f1', bar: '#f1f6ee', icon: '#4f6b4a', text: '#26331f', accent: '#3f8f4a' },
    tileRadius: 0.5,
    cursor: 'solid'
  })
].map((t) => ({ ...t }))

export function findTheme(id: string, user: Theme[]): Theme {
  return user.find((t) => t.id === id) ?? BUILTIN_THEMES.find((t) => t.id === id) ?? BUILTIN_THEMES[0]
}

export function isBuiltinTheme(id: string): boolean {
  return BUILTIN_THEMES.some((t) => t.id === id)
}

/** Variables CSS posées sur la page pour un thème (les couleurs absentes gardent celles du jeu de base). */
export function themeVars(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = { '--tile-radius': String(theme.tileRadius) }
  for (const key of COLOR_KEYS) {
    const v = theme.colors[key]
    if (v) vars[`--${key}`] = v
  }
  if (theme.colors.text) vars['--text-dim'] = `color-mix(in srgb, ${theme.colors.text} 62%, ${theme.colors.bg ?? 'transparent'})`
  if (theme.colors.accent) vars['--accent-soft'] = `color-mix(in srgb, ${theme.colors.accent} 55%, #ffffff)`
  return vars
}
