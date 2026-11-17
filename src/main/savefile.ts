import { existsSync, readdirSync, statSync } from 'fs'
import { basename, dirname, extname, join } from 'path'

const SAVE_EXT = ['.sav', '.dsv', '.srm']
const THREE_DS = ['.3ds', '.cci', '.cxi']

/** Sauvegardes 3DS d'Azahar : `00000001.sav` dans un dossier `data` ; la plus récemment modifiée. */
function newestThreeDsSave(sdmc: string, depth = 9): string | null {
  let best: { file: string; time: number } | null = null
  const walk = (dir: string, left: number): void => {
    let entries: import('fs').Dirent[]
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const full = join(dir, e.name)
      if (e.isDirectory() && left > 0) walk(full, left - 1)
      else if (e.isFile() && e.name === '00000001.sav' && basename(dir) === 'data') {
        const time = statSync(full).mtimeMs
        if (!best || time > best.time) best = { file: full, time }
      }
    }
  }
  if (existsSync(sdmc)) walk(sdmc, depth)
  return (best as { file: string } | null)?.file ?? null
}

/**
 * Fichier de sauvegarde d'un jeu : à côté du fichier de jeu et du même nom (mGBA, melonDS), ou, pour la 3DS,
 * la plus récente dans le dossier d'Azahar.
 * shortcut: en 3DS, Azahar range par identifiant de jeu et non par titre ; on prend la plus récente, à revoir si plusieurs jeux 3DS sont joués.
 */
export function findSaveFile(gameFile: string, sdmc: string): string | null {
  const ext = extname(gameFile).toLowerCase()
  if (THREE_DS.includes(ext)) return newestThreeDsSave(sdmc)
  const stem = basename(gameFile, extname(gameFile)).toLowerCase()
  let names: string[]
  try {
    names = readdirSync(dirname(gameFile))
  } catch {
    return null
  }
  for (const e of SAVE_EXT) {
    const hit = names.find((n) => n.toLowerCase() === stem + e)
    if (hit) return join(dirname(gameFile), hit)
  }
  return null
}
