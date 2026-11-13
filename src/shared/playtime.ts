import type { Config } from './types'

/** Clé de temps de jeu d'un utilisateur pour un jeu. */
export function playtimeKey(profileId: string, gameId: string): string {
  return `${profileId}|${gameId}`
}

/**
 * Secondes jouées par un utilisateur. L'ancien décompte commun (clé sans `|`) revient au premier profil,
 * pour ne rien perdre de l'historique.
 */
export function profilePlaytime(config: Pick<Config, 'playtime' | 'profiles'>, profileId: string, gameId: string): number {
  const own = config.playtime[playtimeKey(profileId, gameId)] ?? 0
  const legacy = config.profiles[0]?.id === profileId ? (config.playtime[gameId] ?? 0) : 0
  return own + legacy
}

/** Décompte sans le temps de jeu de cet utilisateur (« Supprimer l'activité de jeu »). */
export function clearProfilePlaytime(
  config: Pick<Config, 'playtime' | 'profiles'>,
  profileId: string
): Record<string, number> {
  const isFirst = config.profiles[0]?.id === profileId
  const next: Record<string, number> = {}
  for (const [key, value] of Object.entries(config.playtime)) {
    const own = key.startsWith(`${profileId}|`)
    const legacy = isFirst && !key.includes('|')
    if (!own && !legacy) next[key] = value
  }
  return next
}
