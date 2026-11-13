import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { isAbsolute, join, normalize } from 'path'
import { normalizeTitle } from './catalog'
import type { Recipe } from './recipes'

/**
 * Sauvegardes de jeu par profil, comme sur la console : chaque joueur retrouve SA partie.
 *
 * Les dossiers de sauvegarde d'un jeu sont toujours les mêmes (ceux que le jeu lit). Le lanceur échange leur
 * contenu au lancement : il range la partie du joueur précédent, remet celle du joueur actif (ou un dossier vide
 * pour un nouveau joueur) et, à la fermeture du jeu, copie la partie du joueur actif dans son rangement.
 * Avant tout remplacement, une copie de sécurité de ce qui allait être écrasé est gardée.
 */

export interface SaveEnv {
  appdata: string
  localappdata: string
  userprofile: string
}

/** Dossiers de sauvegarde d'un jeu (chemins absolus) : relatifs à son dossier, ou avec {appdata}, {localappdata}, {userprofile}. */
export function resolveSaveDirs(rules: string[], gameDir: string, env: SaveEnv): string[] {
  return rules.map((rule) => {
    const expanded = rule
      .replace(/\{appdata\}/gi, env.appdata)
      .replace(/\{localappdata\}/gi, env.localappdata)
      .replace(/\{userprofile\}/gi, env.userprofile)
    return normalize(isAbsolute(expanded) ? expanded : join(gameDir, expanded))
  })
}

/** Règles de sauvegarde du jeu, d'après la recette qui porte son titre ; vide si le jeu n'en a pas. */
export function saveRulesFor(titles: string[], recipes: Recipe[]): string[] {
  const wanted = new Set(titles.filter(Boolean).map(normalizeTitle))
  return recipes.find((r) => r.saves?.length && wanted.has(normalizeTitle(r.title)))?.saves ?? []
}

const safe = (s: string): string => s.replace(/[^\w.-]/g, '_')
const stamp = (t: number): string => new Date(t).toISOString().replace(/[:T]/g, '-').slice(0, 19)

export class GameSaves {
  /** `root` : dossier où le lanceur range les sauvegardes de tous les profils. */
  constructor(private readonly root: string) {}

  private gameRoot(gameKey: string): string {
    return join(this.root, safe(gameKey))
  }

  private slot(profile: string, gameKey: string, i: number): string {
    return join(this.gameRoot(gameKey), 'profils', safe(profile), String(i))
  }

  private ownerFile(gameKey: string): string {
    return join(this.gameRoot(gameKey), 'proprietaire.json')
  }

  private owner(gameKey: string): string | null {
    try {
      const o = JSON.parse(readFileSync(this.ownerFile(gameKey), 'utf8')) as { profile?: unknown }
      return typeof o.profile === 'string' ? o.profile : null
    } catch {
      return null
    }
  }

  private setOwner(gameKey: string, profile: string): void {
    mkdirSync(this.gameRoot(gameKey), { recursive: true })
    writeFileSync(this.ownerFile(gameKey), JSON.stringify({ profile }), 'utf8')
  }

  /** Copie les dossiers du jeu vers le rangement du profil. */
  private store(profile: string, gameKey: string, dirs: string[]): void {
    dirs.forEach((dir, i) => {
      // Dossier absent : on garde ce qui était rangé plutôt que de l'effacer.
      if (!existsSync(dir)) return
      const slot = this.slot(profile, gameKey, i)
      rmSync(slot, { recursive: true, force: true })
      mkdirSync(join(slot, '..'), { recursive: true })
      cpSync(dir, slot, { recursive: true })
    })
  }

  /** Garde une copie de ce qui va être remplacé (les 5 dernières par jeu). */
  private safetyCopy(gameKey: string, dirs: string[], now: number): void {
    const present = dirs.some((d) => existsSync(d))
    if (!present) return
    const base = join(this.gameRoot(gameKey), 'avant-remplacement')
    const target = join(base, stamp(now))
    dirs.forEach((dir, i) => {
      if (existsSync(dir)) cpSync(dir, join(target, String(i)), { recursive: true })
    })
    const all = existsSync(base) ? readdirSync(base).sort() : []
    for (const old of all.slice(0, Math.max(0, all.length - 5))) rmSync(join(base, old), { recursive: true, force: true })
  }

  /**
   * À faire avant de lancer le jeu : les dossiers du jeu contiennent la partie de `profile`.
   * Le premier joueur à lancer le jeu garde les sauvegardes déjà présentes ; un nouveau joueur repart de zéro.
   */
  prepare(profile: string, gameKey: string, dirs: string[], now = Date.now()): 'inchangé' | 'adopté' | 'restauré' | 'neuf' {
    const owner = this.owner(gameKey)
    if (owner === profile) return 'inchangé'
    if (owner === null) {
      this.store(profile, gameKey, dirs)
      this.setOwner(gameKey, profile)
      return 'adopté'
    }
    // Les dossiers contiennent la partie d'un autre joueur : on la range d'abord.
    this.store(owner, gameKey, dirs)
    this.safetyCopy(gameKey, dirs, now)
    let restored = false
    dirs.forEach((dir, i) => {
      rmSync(dir, { recursive: true, force: true })
      const slot = this.slot(profile, gameKey, i)
      if (existsSync(slot)) {
        mkdirSync(join(dir, '..'), { recursive: true })
        cpSync(slot, dir, { recursive: true })
        restored = true
      }
    })
    this.setOwner(gameKey, profile)
    return restored ? 'restauré' : 'neuf'
  }

  /** À faire quand le jeu est fermé : range la partie du joueur actif. */
  collect(profile: string, gameKey: string, dirs: string[]): boolean {
    if (this.owner(gameKey) !== profile) return false
    this.store(profile, gameKey, dirs)
    return true
  }

  /** Profils qui ont une partie rangée pour ce jeu. */
  profilesWithSaves(gameKey: string): string[] {
    const dir = join(this.gameRoot(gameKey), 'profils')
    return existsSync(dir) ? readdirSync(dir) : []
  }
}
