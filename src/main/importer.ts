import { readdir, stat } from 'fs/promises'
import { basename, extname, join } from 'path'
import type { ProgramCandidate } from '../shared/types'
import { cleanTitle } from './library'

/** Programmes qui ne sont pas le jeu : désinstalleurs, installeurs, composants, rapporteurs d'erreurs… */
const NOT_A_GAME = /(unins|uninst|setup|install|redist|vcredist|vc_redist|dxwebsetup|dotnet|crash|handler|helper|updater|update|patcher|config|prereq|ue4|ue5|easyanticheat|battleye|notification|diagnos|report)/i

const MAX_CANDIDATES = 300
const MAX_DEPTH = 2

const normalize = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, '')

async function exesIn(dir: string, depth: number): Promise<{ path: string; size: number }[]> {
  let entries: import('fs').Dirent[]
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const found: { path: string; size: number }[] = []
  for (const e of entries) {
    const path = join(dir, e.name)
    if (e.isFile() && extname(e.name).toLowerCase() === '.exe' && !NOT_A_GAME.test(e.name)) {
      try {
        found.push({ path, size: (await stat(path)).size })
      } catch {
        // Fichier disparu entre-temps : on l'ignore.
      }
    } else if (e.isDirectory() && depth < MAX_DEPTH && !/^(\.|_commonredist|redist|__|\$)/i.test(e.name)) {
      found.push(...(await exesIn(path, depth + 1)))
    }
  }
  return found
}

/**
 * Cherche les jeux d'un dossier : pour chacun de ses sous-dossiers directs, le programme qui a le plus de chances d'être
 * le jeu (nom proche de celui du dossier, sinon le plus gros). Le titre vient du nom du dossier.
 */
export async function findPrograms(dir: string): Promise<ProgramCandidate[]> {
  if (!dir) return []
  let entries: import('fs').Dirent[]
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const result: ProgramCandidate[] = []
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (result.length >= MAX_CANDIDATES) break
    if (!e.isDirectory() || e.name.startsWith('.')) continue
    const exes = await exesIn(join(dir, e.name), 1)
    if (exes.length === 0) continue
    const folder = normalize(e.name)
    const score = (p: { path: string; size: number }): number => {
      const name = normalize(basename(p.path, extname(p.path)))
      // Un nom très court (« a », « go ») est dans presque tous les noms de dossier : il ne prouve rien.
      const close = name.length >= 4 && (folder.includes(name) || name.includes(folder)) ? 1 : 0
      return close * 1e12 + p.size
    }
    exes.sort((a, b) => score(b) - score(a))
    result.push({ title: cleanTitle(e.name), exe: exes[0].path })
  }
  return result
}
