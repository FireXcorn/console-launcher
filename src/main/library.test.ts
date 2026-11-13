import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildArgs, cleanTitle, gameId, scanLibrary } from './library'

let root: string

function makeGame(name: string, files: string[] = ['run.exe']): string {
  const dir = join(root, name)
  mkdirSync(dir, { recursive: true })
  for (const f of files) writeFileSync(join(dir, f), '')
  return dir
}

const base = { launchExe: 'run.exe', launchArgs: ['--play'], overrides: {}, lastPlayed: {} }

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'lib-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('scanLibrary', () => {
  it('ne garde que les dossiers contenant l’exécutable', async () => {
    makeGame('Alpha')
    makeGame('Vide', ['autre.txt'])
    const games = await scanLibrary({ ...base, gamesDir: root })
    expect(games.map((g) => g.title)).toEqual(['Alpha'])
    expect(games[0].args).toEqual(['--play'])
  })

  it('reconnaît le dossier racine lui-même comme jeu', async () => {
    writeFileSync(join(root, 'run.exe'), '')
    const games = await scanLibrary({ ...base, gamesDir: root })
    expect(games).toHaveLength(1)
    expect(games[0].dir).toBe(root)
  })

  it('détecte l’image et applique les surcharges', async () => {
    const a = makeGame('Alpha', ['run.exe', 'icon.png'])
    const b = makeGame('Beta')
    const games = await scanLibrary({
      ...base,
      gamesDir: root,
      overrides: { [gameId(b)]: { title: 'Mon jeu' } }
    })
    const byId = Object.fromEntries(games.map((g) => [g.id, g]))
    expect(byId[gameId(a)].iconPath).toBe(join(a, 'icon.png'))
    expect(byId[gameId(b)].title).toBe('Mon jeu')
    expect(byId[gameId(b)].iconPath).toBeNull()
  })

  it('trie par dernier lancement', async () => {
    makeGame('Alpha')
    const b = makeGame('Beta')
    const games = await scanLibrary({ ...base, gamesDir: root, lastPlayed: { [gameId(b)]: 10 } })
    expect(games.map((g) => g.title)).toEqual(['Beta', 'Alpha'])
  })

  it('renvoie une liste vide si le dossier est absent', async () => {
    expect(await scanLibrary({ ...base, gamesDir: join(root, 'nope') })).toEqual([])
  })
})

describe('utilitaires', () => {
  it('remplace {dir} dans les arguments', () => {
    expect(buildArgs(['--launch', '{dir}\\bin'], 'C:\\G')).toEqual(['--launch', 'C:\\G\\bin'])
  })

  it('nettoie les titres', () => {
    expect(cleanTitle('Super_Jeu [v1.2] (EU)')).toBe('Super Jeu')
  })
})
