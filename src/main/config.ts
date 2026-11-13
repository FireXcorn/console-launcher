import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { dirname, join } from 'path'
import type { Config, Profile } from '../shared/types'

export const DEFAULT_PROFILE_COLOR = '#2f6fe0'

/** Un avatar est une créature (identifiant simple) ou `file:<chemin relatif>` sans « .. » ni chemin absolu. */
export function safeAvatar(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) return ''
  if (/^[a-z0-9_-]{1,30}$/i.test(value)) return value
  if (value.startsWith('file:') && value.length <= 205) {
    const rel = value.slice(5)
    const parts = rel.split(/[\\/]/)
    if (rel && !/^([a-z]:|[\\/])/i.test(rel) && !parts.includes('..') && !parts.includes('')) return value
  }
  return ''
}

/** Arrière-plans reconnus : uni, dégradé ou motif ; un identifiant inconnu retombe sur la couleur. */
export function safeBackground(value: unknown, color: string): string {
  if (typeof value === 'string' && /^(c:#[0-9a-f]{6}|[gp]:[a-z0-9-]{1,24})$/i.test(value)) return value
  return `c:${color}`
}

/** Rend un profil lu dans le fichier de configuration sûr à utiliser ; null s'il est inutilisable. */
export function normalizeProfile(raw: unknown, fallbackId: string): Profile | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const text = (v: unknown, fallback: string, max: number): string =>
    typeof v === 'string' ? v.slice(0, max) : fallback
  const color = typeof r.color === 'string' && /^#[0-9a-f]{6}$/i.test(r.color) ? r.color : DEFAULT_PROFILE_COLOR
  return {
    id: text(r.id, fallbackId, 40) || fallbackId,
    name: text(r.name, 'Joueur', 24).trim() || 'Joueur',
    color,
    background: safeBackground(r.background, color),
    avatar: safeAvatar(r.avatar),
    image: text(r.image, '', 600)
  }
}

/**
 * Liste de profils valide : au moins un profil, identifiants uniques. Une ancienne configuration à
 * profil unique (`profile`) devient le premier profil.
 */
export function normalizeProfiles(raw: Record<string, unknown>): { profiles: Profile[]; activeProfile: string } {
  const seen = new Set<string>()
  const profiles: Profile[] = []
  const list = Array.isArray(raw.profiles) ? raw.profiles : []
  list.forEach((item, i) => {
    const p = normalizeProfile(item, `p${i + 1}`)
    if (!p) return
    while (seen.has(p.id)) p.id += '_'
    seen.add(p.id)
    profiles.push(p)
  })
  if (profiles.length === 0) {
    profiles.push(normalizeProfile({ ...(raw.profile as object), id: 'p1' }, 'p1') ?? defaultProfile())
  }
  const active = typeof raw.activeProfile === 'string' && seen.size > 0 && profiles.some((p) => p.id === raw.activeProfile)
  return { profiles, activeProfile: active ? (raw.activeProfile as string) : profiles[0].id }
}

export function defaultProfile(): Profile {
  return {
    id: 'p1',
    name: 'Joueur',
    color: DEFAULT_PROFILE_COLOR,
    background: `c:${DEFAULT_PROFILE_COLOR}`,
    avatar: '',
    image: ''
  }
}

export function defaultConfig(): Config {
  const games = join(homedir(), 'Games')
  return {
    gamesDir: existsSync(games) ? games : '',
    // À renseigner dans Paramètres > Bibliothèque (nom du programme, relatif au dossier de chaque jeu).
    launchExe: '',
    launchArgs: [],
    appTitle: 'Console Launcher',
    appIcon: '',
    theme: 'light',
    activeTheme: 'clair',
    fullscreen: true,
    autoStart: false,
    gameBackdrop: true,
    backdropsDir: join(homedir(), 'Pictures', 'Fonds de jeux'),
    swapConfirm: false,
    albumDir: join(homedir(), 'Pictures', 'Captures de la console'),
    captureKey: 'F12',
    newsFeedUrl: 'https://www.nintendolife.com/feeds/latest',
    charactersDir: join(homedir(), 'Pictures', 'Personnages'),
    profiles: [defaultProfile()],
    activeProfile: 'p1',
    emulated: [],
    showMissingGames: true,
    coversDir: join(homedir(), 'Pictures', 'Jaquettes'),
    audioDir: join(homedir(), 'Music', 'Console Launcher'),
    sfxVolume: 70,
    musicVolume: 40,
    muted: false,
    playtime: {},
    overrides: {},
    lastPlayed: {}
  }
}

export class ConfigStore {
  private data: Config

  constructor(private file: string) {
    this.data = defaultConfig()
    try {
      const raw = JSON.parse(readFileSync(file, 'utf8'))
      if (raw && typeof raw === 'object') {
        const merged = { ...this.data, ...raw, ...normalizeProfiles(raw) }
        delete (merged as Record<string, unknown>).profile // ancien profil unique, migré dans `profiles`
        // Avant les thèmes, seul « clair / sombre » existait : on le retrouve comme thème actif.
        if (typeof raw.activeTheme !== 'string') merged.activeTheme = raw.theme === 'dark' ? 'sombre' : 'clair'
        this.data = merged as Config
      }
    } catch {
      // Fichier absent ou illisible : on garde les valeurs par défaut.
    }
  }

  get(): Config {
    return this.data
  }

  set(patch: Partial<Config>): Config {
    this.data = { ...this.data, ...patch }
    mkdirSync(dirname(this.file), { recursive: true })
    writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf8')
    return this.data
  }
}
