import { readdir, stat } from 'fs/promises'
import { extname, isAbsolute, join, relative, resolve } from 'path'
import type { AlbumItem } from '../shared/types'

const EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp'])

export function isImageFile(file: string): boolean {
  return EXTS.has(extname(file).toLowerCase())
}

/** Vrai si `file` se trouve strictement à l'intérieur de `dir` (anti « ..\ »). */
export function insideDir(dir: string, file: string): boolean {
  if (!dir) return false
  const rel = relative(resolve(dir), resolve(file))
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

/** Images du dossier (sans sous-dossiers), les plus récentes d'abord. */
export async function listImageFiles(dir: string, limit = 300): Promise<AlbumItem[]> {
  if (!dir) return []
  let names: string[]
  try {
    names = await readdir(dir)
  } catch {
    return []
  }
  const items: AlbumItem[] = []
  for (const name of names) {
    if (!isImageFile(name)) continue
    const path = join(dir, name)
    try {
      const info = await stat(path)
      if (info.isFile()) items.push({ path, name, modified: info.mtimeMs })
    } catch {
      // Fichier disparu entre-temps : ignoré.
    }
  }
  return items.sort((a, b) => b.modified - a.modified || a.name.localeCompare(b.name)).slice(0, limit)
}

export function captureFileName(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return (
    `Capture ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}.png`
  )
}
