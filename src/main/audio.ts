import { existsSync, statSync } from 'fs'
import { join } from 'path'

export const AUDIO_NAMES = ['menu', 'deplacer', 'valider', 'retour', 'lancer', 'refuser'] as const
export type AudioName = (typeof AUDIO_NAMES)[number]

const EXTS = ['.mp3', '.ogg', '.wav', '.flac', '.m4a']
export const MAX_AUDIO_BYTES = 30 * 1024 * 1024

/** Liste blanche : le nom vient de l'interface, il ne doit jamais servir à composer un chemin libre. */
export function isAudioName(value: unknown): value is AudioName {
  return typeof value === 'string' && (AUDIO_NAMES as readonly string[]).includes(value)
}

/** Fichier de remplacement `<dossier>\<nom>.(mp3|ogg|wav|flac|m4a)` s'il existe et n'est pas trop lourd. */
export function findAudioFile(dir: string, name: AudioName): string | null {
  if (!dir) return null
  for (const ext of EXTS) {
    const path = join(dir, name + ext)
    try {
      if (existsSync(path) && statSync(path).isFile() && statSync(path).size <= MAX_AUDIO_BYTES) return path
    } catch {
      // Illisible : on essaie l'extension suivante.
    }
  }
  return null
}
