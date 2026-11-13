import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'fs'
import { basename, extname, join } from 'path'
import type { BackupInfo, Config, Profile } from '../shared/types'

/** Ce qu'une sauvegarde contient : tout ce qui appartient aux joueurs, rien qui dépende de la machine. */
export interface BackupData {
  format: 1
  createdAt: number
  /** Raison : « auto », « manuelle », « avant restauration »… */
  reason: string
  profiles: Profile[]
  activeProfile: string
  playtime: Record<string, number>
  lastPlayed: Record<string, number>
  /** Titres choisis par le joueur (les images restent là où elles sont). */
  titles: Record<string, string>
  /** Photos personnelles des profils (URL data:), par identifiant de profil. */
  photos: Record<string, string>
}

const MAX_PHOTO_BYTES = 3 * 1024 * 1024
const MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }

function photoOf(path: string): string | null {
  try {
    const mime = MIME[extname(path).toLowerCase()]
    if (!mime || !existsSync(path) || statSync(path).size > MAX_PHOTO_BYTES) return null
    return `data:${mime};base64,${readFileSync(path).toString('base64')}`
  } catch {
    return null
  }
}

/** Instantané des données des joueurs. */
export function takeSnapshot(cfg: Config, reason: string, now = Date.now()): BackupData {
  const photos: Record<string, string> = {}
  for (const p of cfg.profiles) {
    const data = p.image ? photoOf(p.image) : null
    if (data) photos[p.id] = data
  }
  const titles: Record<string, string> = {}
  for (const [id, o] of Object.entries(cfg.overrides ?? {})) if (o.title?.trim()) titles[id] = o.title.trim()
  return {
    format: 1,
    createdAt: now,
    reason,
    profiles: cfg.profiles,
    activeProfile: cfg.activeProfile,
    playtime: cfg.playtime ?? {},
    lastPlayed: cfg.lastPlayed ?? {},
    titles,
    photos
  }
}

/** Empreinte de ce qui compte : sert à ne pas empiler des sauvegardes identiques. */
export function fingerprint(data: BackupData): string {
  const { createdAt: _c, reason: _r, ...rest } = data
  return JSON.stringify(rest)
}

/** Vérifie un contenu lu depuis un fichier ; renvoie null s'il ne ressemble pas à une sauvegarde. */
export function parseBackup(text: string): BackupData | null {
  try {
    const raw = JSON.parse(text.replace(/^﻿/, '')) as Partial<BackupData>
    if (raw.format !== 1 || !Array.isArray(raw.profiles) || raw.profiles.length === 0) return null
    const ok = raw.profiles.every((p) => p && typeof p.id === 'string' && typeof p.name === 'string')
    if (!ok) return null
    return {
      format: 1,
      createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : 0,
      reason: typeof raw.reason === 'string' ? raw.reason : '',
      profiles: raw.profiles,
      activeProfile: typeof raw.activeProfile === 'string' ? raw.activeProfile : raw.profiles[0].id,
      playtime: raw.playtime && typeof raw.playtime === 'object' ? raw.playtime : {},
      lastPlayed: raw.lastPlayed && typeof raw.lastPlayed === 'object' ? raw.lastPlayed : {},
      titles: raw.titles && typeof raw.titles === 'object' ? raw.titles : {},
      photos: raw.photos && typeof raw.photos === 'object' ? raw.photos : {}
    }
  } catch {
    return null
  }
}

const stamp = (t: number): string => {
  const d = new Date(t)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

/** Écrit la sauvegarde (fichier temporaire puis renommage : jamais à moitié écrite). Renvoie son nom. */
export function writeBackup(dir: string, data: BackupData): string {
  mkdirSync(dir, { recursive: true })
  const name = `joueurs-${stamp(data.createdAt)}.json`
  const target = join(dir, name)
  const tmp = target + '.tmp'
  writeFileSync(tmp, JSON.stringify(data), 'utf8')
  renameSync(tmp, target)
  return name
}

/** Sauvegardes du dossier, de la plus récente à la plus ancienne. */
export function listBackups(dir: string): BackupInfo[] {
  if (!existsSync(dir)) return []
  const out: BackupInfo[] = []
  for (const name of readdirSync(dir)) {
    if (!/^joueurs-.*\.json$/i.test(name)) continue
    const data = parseBackup(readFileSync(join(dir, name), 'utf8'))
    if (!data) continue
    out.push({ name, createdAt: data.createdAt, reason: data.reason, profiles: data.profiles.map((p) => p.name) })
  }
  return out.sort((a, b) => b.createdAt - a.createdAt)
}

/** Ne garde que les `keep` sauvegardes les plus récentes. */
export function pruneBackups(dir: string, keep: number): void {
  for (const b of listBackups(dir).slice(keep)) {
    try {
      unlinkSync(join(dir, b.name))
    } catch {
      // Fichier déjà parti ou verrouillé : on réessaiera à la prochaine sauvegarde.
    }
  }
}

/**
 * Sauvegarde automatique : une par heure au plus, et seulement si quelque chose a changé depuis la
 * dernière. Renvoie le nom du fichier créé, ou null.
 */
export function autoBackup(dir: string, cfg: Config, now = Date.now(), keep = 30): string | null {
  const data = takeSnapshot(cfg, 'automatique', now)
  const last = listBackups(dir)[0]
  if (last) {
    const lastData = parseBackup(readFileSync(join(dir, last.name), 'utf8'))
    const recent = now - last.createdAt < 60 * 60 * 1000
    if (lastData && (recent || fingerprint(lastData) === fingerprint(data))) return null
  }
  const name = writeBackup(dir, data)
  pruneBackups(dir, keep)
  return name
}

/**
 * Réglages à appliquer pour restaurer : profils, temps de jeu, dernières parties et titres choisis. Les
 * photos sont réécrites dans `photosDir` et les profils pointent vers ces nouveaux fichiers.
 */
export function restorePatch(data: BackupData, current: Config, photosDir: string): Partial<Config> {
  const profiles = data.profiles.map((p) => {
    const photo = data.photos[p.id]
    const m = photo ? /^data:(image\/(png|jpeg|webp));base64,(.+)$/.exec(photo) : null
    if (!m) return p
    mkdirSync(photosDir, { recursive: true })
    const file = join(photosDir, `${basename(p.id).replace(/[^\w-]/g, '_')}.${m[2] === 'jpeg' ? 'jpg' : m[2]}`)
    writeFileSync(file, Buffer.from(m[3], 'base64'))
    return { ...p, image: file }
  })
  const overrides = { ...current.overrides }
  for (const [id, title] of Object.entries(data.titles)) overrides[id] = { ...overrides[id], title }
  return {
    profiles,
    activeProfile: profiles.some((p) => p.id === data.activeProfile) ? data.activeProfile : profiles[0].id,
    playtime: data.playtime,
    lastPlayed: data.lastPlayed,
    overrides
  }
}
