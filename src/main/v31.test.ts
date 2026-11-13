import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { missingEntries } from './catalog'
import { DEFAULT_DIALOG_PATTERN, DEFAULT_READY_TITLE, emulatedId, scanLibrary } from './library'

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'v31-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

const base = { gamesDir: join(tmpdir(), 'inexistant-v31'), launchExe: 'x.exe', launchArgs: [], overrides: {}, lastPlayed: {} }

function setup(): { exe: string; game: string } {
  const emu = join(root, 'emulateur')
  mkdirSync(emu)
  const exe = join(emu, 'emu.exe')
  const game = join(root, 'Mario Kart World [01].nup')
  writeFileSync(exe, '')
  writeFileSync(game, '')
  return { exe, game }
}

describe('jeux lancés par un émulateur', () => {
  it('apparaît dans la bibliothèque avec ses arguments complétés', async () => {
    const { exe, game } = setup()
    const games = await scanLibrary({
      ...base,
      emulated: [{ title: 'Mario Kart World', emulatorExe: exe, gameFile: game, args: ['-f', '-g', '{game}'], readyTitle: '' }]
    })
    expect(games).toHaveLength(1)
    expect(games[0]).toMatchObject({
      id: emulatedId('Mario Kart World'),
      title: 'Mario Kart World',
      exePath: exe,
      emulated: true
    })
    expect(games[0].watch).toMatchObject({ readyTitle: DEFAULT_READY_TITLE, dialogPattern: DEFAULT_DIALOG_PATTERN, settleMs: 5000 })
    expect(games[0].dir).toBe(join(root, 'emulateur'))
    expect(games[0].args).toEqual(['-f', '-g', game])
  })

  it('disparaît si l’émulateur ou le fichier du jeu manque', async () => {
    const { exe, game } = setup()
    const entry = { title: 'Mario Kart World', emulatorExe: exe, gameFile: game, args: ['{game}'], readyTitle: '' }
    expect(await scanLibrary({ ...base, emulated: [{ ...entry, gameFile: join(root, 'absent.nup') }] })).toEqual([])
    expect(await scanLibrary({ ...base, emulated: [{ ...entry, emulatorExe: join(root, 'absent.exe') }] })).toEqual([])
    expect(await scanLibrary({ ...base, emulated: [{ ...entry, title: '  ' }] })).toEqual([])
  })

  it('un jeu recompilé se lance seul : pas de fichier de jeu', async () => {
    const { exe } = setup()
    const entry = { title: 'Donkey Kong Bananza', emulatorExe: exe, gameFile: '', args: [] as string[], readyTitle: '^DKB' }
    const games = await scanLibrary({ ...base, emulated: [entry] })
    expect(games).toHaveLength(1)
    expect(games[0]).toMatchObject({ title: 'Donkey Kong Bananza', exePath: exe, args: [] })
    // Avec {game} dans les arguments, il faudrait un fichier : l'entrée est écartée.
    expect(await scanLibrary({ ...base, emulated: [{ ...entry, args: ['{game}'] }] })).toEqual([])
  })

  it('retire l’entrée « cartouche vide » du même jeu et respecte un titre personnalisé', async () => {
    const { exe, game } = setup()
    const games = await scanLibrary({
      ...base,
      overrides: { [emulatedId('Mario Kart World')]: { title: 'MKW' } },
      emulated: [{ title: 'Mario Kart World', emulatorExe: exe, gameFile: game, args: [], readyTitle: '^MK' }]
    })
    expect(games[0].title).toBe('MKW')
    expect(games[0].watch?.readyTitle).toBe('^MK')
    expect(missingEntries(['Mario Kart World']).some((e) => e.title === 'Mario Kart World')).toBe(false)
  })

  it('avec un journal d’émulateur, le titre de la fenêtre n’est pas utilisé par défaut', async () => {
    const { exe, game } = setup()
    const games = await scanLibrary({
      ...base,
      emulated: [
        {
          title: 'Mario Kart World',
          emulatorExe: exe,
          gameFile: game,
          args: [],
          readyTitle: '',
          readyLog: join(root, 'log.txt'),
          readyPattern: 'Report: Available VRAM',
          settleMs: 1234
        }
      ]
    })
    expect(games[0].watch).toMatchObject({
      readyTitle: '',
      readyLog: join(root, 'log.txt'),
      readyPattern: 'Report: Available VRAM',
      settleMs: 1234
    })
  })

  it('les questions recommandées de l’émulateur sont reconnues', () => {
    const re = /recommended|recommand|fullscreen|plein .cran/i
    expect(re.test('Use the recommended settings for Mario Kart World?')).toBe(true)
    expect(re.test('Do you want to launch the game in fullscreen?')).toBe(true)
    expect(re.test('Do you want to delete this save?')).toBe(false)
  })

  it('le titre qui prouve que le jeu tourne exige plusieurs séparateurs', () => {
    const re = new RegExp(DEFAULT_READY_TITLE)
    expect(re.test('eglantine | build 212')).toBe(false)
    expect(re.test('eglantine | build 212 | Mario Kart World | Vulkan')).toBe(true)
  })
})
