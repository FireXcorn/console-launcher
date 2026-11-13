import { readdir, stat } from 'fs/promises'
import { basename, extname, join, resolve } from 'path'
import { insideDir, isImageFile } from './album'

const MAX_IMAGES = 300
const MAX_BYTES = 8 * 1024 * 1024

export interface CharacterFile {
  /** Valeur de `Profile.avatar` : `file:<chemin relatif>` (séparateurs « / »). */
  id: string
  name: string
  path: string
}

export interface CharacterFiles {
  /** Nom du sous-dossier ; vide pour les images posées directement dans le dossier. */
  series: string
  files: CharacterFile[]
}

/** Nom lisible : sans extension, tirets et soulignés remplacés par des espaces. */
export function characterName(file: string): string {
  const base = basename(file, extname(file)).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return base || basename(file)
}

/**
 * Images du dossier de personnages : celles du dossier lui-même, puis un niveau de sous-dossiers
 * (chacun une série). Plafonné en nombre et en poids ; tout le reste est ignoré.
 */
export async function listCharacterFiles(dir: string): Promise<CharacterFiles[]> {
  if (!dir) return []
  let total = 0
  const scan = async (folder: string, prefix: string): Promise<CharacterFile[]> => {
    let names: import('fs').Dirent[]
    try {
      names = await readdir(folder, { withFileTypes: true })
    } catch {
      return []
    }
    const files: CharacterFile[] = []
    for (const entry of names.sort((a, b) => a.name.localeCompare(b.name))) {
      if (total >= MAX_IMAGES) break
      if (!entry.isFile() || !isImageFile(entry.name)) continue
      const path = join(folder, entry.name)
      try {
        if ((await stat(path)).size > MAX_BYTES) continue
      } catch {
        continue
      }
      files.push({ id: `file:${prefix}${entry.name}`, name: characterName(entry.name), path })
      total++
    }
    return files
  }

  const result: CharacterFiles[] = []
  const top = await scan(dir, '')
  if (top.length > 0) result.push({ series: '', files: top })
  let entries: import('fs').Dirent[] = []
  try {
    entries = (await readdir(dir, { withFileTypes: true })).filter((e) => e.isDirectory())
  } catch {
    return result
  }
  for (const folder of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const files = await scan(join(dir, folder.name), `${folder.name}/`)
    if (files.length > 0) result.push({ series: folder.name, files })
  }
  return result
}

/** Fichier désigné par un avatar `file:…`, seulement s'il est bien dans le dossier de personnages. */
export function resolveCharacterFile(dir: string, avatar: string): string | null {
  if (!dir || !avatar.startsWith('file:')) return null
  const path = resolve(dir, ...avatar.slice(5).split('/'))
  return insideDir(dir, path) && isImageFile(path) ? path : null
}
