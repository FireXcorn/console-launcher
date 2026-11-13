import { spawn, type ChildProcess } from 'child_process'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import type { EmulatedGame, RecipeInfo, RecipeNeed } from '../shared/types'

/**
 * Une « recette » décrit comment préparer un jeu à partir d'un outil livré avec le lanceur
 * (émulateur, outil de recompilation) : ce que l'utilisateur doit fournir, l'étape de préparation
 * éventuelle, et comment lancer le jeu ensuite. Elle ne contient aucun chemin absolu.
 */
export interface Recipe {
  id: string
  title: string
  /** Dossier de l'outil, relatif au dossier `tools`. */
  tool: string
  /**
   * Où se trouve le jeu une fois prêt : `tool` (dans le dossier de l'outil), `out` (dossier que le lanceur
   * crée pour ce jeu, voir `{out}`) ou `need:<id>` (dossier que l'utilisateur indique, ex. là où l'outil a construit le jeu).
   */
  base?: string
  /** Programme qui lance le jeu, relatif à ce dossier. */
  exe: string
  args?: string[]
  readyTitle?: string
  settleMs?: number
  borderless?: boolean
  /** Ce que l'utilisateur doit fournir. */
  needs?: RecipeNeed[]
  /** Entrée dont le chemin devient le fichier du jeu (`{game}`). */
  gameFileFrom?: string
  /**
   * Préparation. `gui` (défaut) : l'outil s'ouvre dans sa propre fenêtre. `cli` : le lanceur exécute la commande et
   * affiche sa progression. `exe` est relatif au dossier de l'outil ; dans `args`, `{id}` = entrée de l'utilisateur
   * et `{out}` = dossier du jeu.
   */
  setup?: { mode?: 'gui' | 'cli'; exe: string; args?: string[]; note?: string }
  /** Fichier (relatif au dossier du jeu) dont la présence prouve que la préparation est faite. */
  doneFile?: string
}

export type RecipeInputs = Record<string, Record<string, string>>

/** Dossiers que les recettes utilisent : outils livrés, et dossier des jeux préparés par le lanceur. */
export interface RecipePaths {
  toolsDir: string
  outRoot: string
}

/** Lit les recettes d'un dossier (un fichier .json par recette) ; les fichiers invalides sont ignorés. */
export function loadRecipes(dir: string): Recipe[] {
  if (!existsSync(dir)) return []
  const recipes: Recipe[] = []
  for (const name of readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.json')).sort()) {
    try {
      const raw = JSON.parse(readFileSync(join(dir, name), 'utf8').replace(/^﻿/, '')) as Partial<Recipe>
      if (typeof raw.id !== 'string' || !raw.id || typeof raw.title !== 'string' || !raw.title) continue
      if (typeof raw.tool !== 'string' || typeof raw.exe !== 'string' || !raw.exe) continue
      const needs = Array.isArray(raw.needs)
        ? raw.needs.filter((n): n is RecipeNeed => !!n && typeof n.id === 'string' && typeof n.label === 'string')
        : []
      recipes.push({ ...(raw as Recipe), needs })
    } catch {
      // Recette illisible : on passe à la suivante.
    }
  }
  return recipes
}

type Exists = (path: string) => boolean

/** Dossier où vit le jeu prêt, ou null si l'utilisateur ne l'a pas encore indiqué. */
export function gameBase(r: Recipe, paths: RecipePaths, inputs: RecipeInputs): string | null {
  const base = r.base ?? 'tool'
  if (base === 'out') return join(paths.outRoot, r.id)
  if (base.startsWith('need:')) return inputs[r.id]?.[base.slice(5)] || null
  return join(paths.toolsDir, r.tool)
}

/** État d'une recette : outil présent ? entrées données ? préparation faite ? */
export function recipeInfo(r: Recipe, paths: RecipePaths, inputs: RecipeInputs, exists: Exists = existsSync): RecipeInfo {
  const given = inputs[r.id] ?? {}
  const base = { id: r.id, title: r.title, needs: r.needs ?? [], inputs: given, note: r.setup?.note ?? '', hasSetup: !!r.setup, cli: r.setup?.mode === 'cli' }
  // Le programme qui prépare (ou, sans préparation, qui lance) le jeu doit être dans le dossier de l'outil.
  if (!exists(join(paths.toolsDir, r.tool, r.setup?.exe ?? r.exe))) return { ...base, state: 'no-tool' }
  // Les entrées servant à la préparation (fichier de jeu…) d'abord ; le dossier de sortie indiqué par l'utilisateur ensuite.
  const setupNeeds = (r.needs ?? []).filter((n) => `need:${n.id}` !== r.base)
  if (setupNeeds.some((n) => !n.optional && !(given[n.id] && exists(given[n.id])))) return { ...base, state: 'needs-input' }
  const dir = gameBase(r, paths, inputs)
  const built = !!dir && exists(join(dir, r.doneFile ?? r.exe))
  if (!built) return { ...base, state: 'needs-setup' }
  return { ...base, state: 'ready' }
}

/** Entrées de jeu prêtes à lancer, au même format que les jeux ajoutés à la main. */
export function recipeEntries(recipes: Recipe[], paths: RecipePaths, inputs: RecipeInputs, exists: Exists = existsSync): EmulatedGame[] {
  const entries: EmulatedGame[] = []
  for (const r of recipes) {
    if (recipeInfo(r, paths, inputs, exists).state !== 'ready') continue
    const dir = gameBase(r, paths, inputs)
    if (!dir) continue
    const gameFile = r.gameFileFrom ? (inputs[r.id]?.[r.gameFileFrom] ?? '') : ''
    entries.push({
      title: r.title,
      emulatorExe: join(dir, r.exe),
      gameFile,
      args: r.args ?? [],
      readyTitle: r.readyTitle ?? '',
      settleMs: r.settleMs,
      borderless: r.borderless
    })
  }
  return entries
}

/** Arguments de la préparation : `{id}` devient l'entrée de l'utilisateur, `{out}` le dossier du jeu. */
export function setupArgs(r: Recipe, paths: RecipePaths, inputs: RecipeInputs): string[] {
  const given = inputs[r.id] ?? {}
  return (r.setup?.args ?? []).map((a) =>
    a.replace(/\{(\w+)\}/g, (_m, id: string) => (id === 'out' ? join(paths.outRoot, r.id) : (given[id] ?? '')))
  )
}

/**
 * Lance la préparation. `gui` : l'outil s'ouvre seul. `cli` : la sortie est transmise ligne par ligne à `onLine`,
 * `onDone(code)` est appelé à la fin. Renvoie le processus, ou null si l'outil est introuvable.
 */
export function runSetup(
  r: Recipe,
  paths: RecipePaths,
  inputs: RecipeInputs,
  onLine: (line: string) => void = () => undefined,
  onDone: (code: number | null) => void = () => undefined
): ChildProcess | null {
  if (!r.setup) return null
  const toolDir = join(paths.toolsDir, r.tool)
  const exe = join(toolDir, r.setup.exe)
  if (!existsSync(exe)) return null
  const args = setupArgs(r, paths, inputs)
  if (r.setup.mode !== 'cli') {
    const child = spawn(exe, args, { cwd: toolDir, detached: true, stdio: 'ignore' })
    child.on('error', () => undefined)
    child.unref()
    return child
  }
  const child = spawn(exe, args, { cwd: toolDir, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  let pending = ''
  const feed = (chunk: Buffer): void => {
    pending += String(chunk)
    let nl: number
    while ((nl = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, nl).trim()
      pending = pending.slice(nl + 1)
      if (line) onLine(line)
    }
  }
  child.stdout?.on('data', feed)
  child.stderr?.on('data', feed)
  child.on('error', () => onDone(null))
  child.on('close', (code) => onDone(code))
  return child
}

/** Phrase lisible pour une ligne de la sortie d'un outil ; une ligne JSON d'évènement (étape, progression, erreur) est résumée. */
export function describeLine(line: string): string {
  if (!line.startsWith('{')) return line
  try {
    const e = JSON.parse(line) as Record<string, unknown>
    const pct = typeof e.done === 'number' && typeof e.total === 'number' && e.total > 0 ? ` ${Math.floor((e.done / e.total) * 100)} %` : ''
    switch (e.type) {
      case 'step':
        return `Étape ${String(e.step)} : ${e.state === 'done' ? 'terminée' : e.state === 'skipped' ? 'ignorée' : 'en cours'}`
      case 'progress':
        return `${String(e.step)}${e.phase ? ' — ' + String(e.phase) : ''}${pct}`
      case 'error':
        return `Erreur : ${String(e.id)}${e.params ? ' ' + JSON.stringify(e.params) : ''}`
      case 'warning':
        return `Avertissement : ${String(e.id)}`
      case 'end':
        return e.result === 'ok' ? 'Terminé' : `Terminé : ${String(e.result)}`
      default:
        return line
    }
  } catch {
    return line
  }
}
