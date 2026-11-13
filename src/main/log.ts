import { appendFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'fs'
import { dirname } from 'path'

const MAX_BYTES = 512 * 1024
let file: string | null = null

/** Journal texte dans les données de l'application, remis à zéro quand il devient trop gros. */
export function initLog(path: string): void {
  file = path
  try {
    mkdirSync(dirname(path), { recursive: true })
    if (existsSync(path) && statSync(path).size > MAX_BYTES) writeFileSync(path, '')
  } catch {
    file = null
  }
}

export function log(...parts: unknown[]): void {
  if (!file) return
  const text = parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join(' ')
  try {
    appendFileSync(file, `${new Date().toISOString()} ${text}\n`)
  } catch {
    // Le journal ne doit jamais faire échouer l'application.
  }
}
