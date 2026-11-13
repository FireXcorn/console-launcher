import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { findAudioFile, isAudioName } from './audio'
import { catalogId, findBackdrop, findCover, missingEntries, normalizeTitle } from './catalog'

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'v3-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('catalogue des exclusivités', () => {
  it('normalise les titres (accents, ponctuation, esperluette)', () => {
    expect(normalizeTitle('Pokémon Winds & Waves')).toBe('pokemonwindsandwaves')
    expect(normalizeTitle('CARD&CASINO')).toBe('cardandcasino')
    expect(normalizeTitle('  Mario  Kart World ')).toBe('mariokartworld')
  })

  it('ne garde que les cinq jeux choisis, dans l’ordre voulu', () => {
    const titles = missingEntries([]).map((e) => e.title)
    expect(titles).toEqual([
      'Kirby Air Riders',
      'Pokémon Pokopia',
      'Yoshi and the Mysterious Book',
      'Splatoon Raiders',
      'Star Fox'
    ])
  })
  it('n’ajoute ni le DLC ni notre Zelda, et ne crée aucun doublon', () => {
    const entries = missingEntries([])
    const titles = entries.map((e) => e.title)
    expect(titles.some((t) => /Expansion Pass/i.test(t))).toBe(false)
    expect(titles.some((t) => /Ocarina/i.test(t))).toBe(false)
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length)
    expect(entries.every((e) => e.id.startsWith('catalog:'))).toBe(true)
  })

  it('écarte un jeu déjà installé, même renommé autour du titre', () => {
    const before = missingEntries([]).length
    const after = missingEntries(['Kirby Air Riders', 'Splatoon Raiders (v1.0)'])
    expect(after.length).toBe(before - 2)
    expect(after.some((e) => e.title === 'Kirby Air Riders')).toBe(false)
  })

  it('garde un identifiant stable', () => {
    expect(catalogId('Mario Kart World')).toBe('catalog:mariokartworld')
  })

  it('trouve une jaquette déposée par l’utilisateur', () => {
    writeFileSync(join(root, 'mario kart world.png'), '')
    writeFileSync(join(root, 'kirbyairriders.jpg'), '')
    // Windows ignore la casse : on compare sans en tenir compte.
    expect(findCover(root, 'Mario Kart World')?.toLowerCase()).toBe(join(root, 'mario kart world.png').toLowerCase())
    expect(findCover(root, 'Kirby Air Riders')).toBe(join(root, 'kirbyairriders.jpg'))
    expect(findCover(root, 'Star Fox')).toBeNull()
    expect(findCover('', 'Star Fox')).toBeNull()
  })

  it('trouve une grande image de fond (avif accepté), sans confondre avec une jaquette', () => {
    writeFileSync(join(root, 'Donkey Kong Bananza.avif'), '')
    expect(findBackdrop(root, 'Donkey Kong Bananza')?.toLowerCase()).toBe(join(root, 'donkey kong bananza.avif').toLowerCase())
    expect(findCover(root, 'Donkey Kong Bananza')).toBeNull()
    expect(findBackdrop(root, 'Star Fox')).toBeNull()
    expect(findBackdrop('', 'Star Fox')).toBeNull()
    expect(findBackdrop(root, '..\\..\\secret')).toBeNull()
  })
})

describe('fichiers audio de remplacement', () => {
  it('n’accepte que les noms de la liste blanche', () => {
    expect(isAudioName('menu')).toBe(true)
    expect(isAudioName('valider')).toBe(true)
    expect(isAudioName('..\\..\\secret')).toBe(false)
    expect(isAudioName('menu.mp3')).toBe(false)
    expect(isAudioName(42)).toBe(false)
  })

  it('trouve le fichier quelle que soit l’extension audio', () => {
    const dir = join(root, 'audio')
    mkdirSync(dir)
    writeFileSync(join(dir, 'menu.ogg'), 'x')
    writeFileSync(join(dir, 'valider.wav'), 'x')
    writeFileSync(join(dir, 'retour.txt'), 'x')
    expect(findAudioFile(dir, 'menu')).toBe(join(dir, 'menu.ogg'))
    expect(findAudioFile(dir, 'valider')).toBe(join(dir, 'valider.wav'))
    expect(findAudioFile(dir, 'retour')).toBeNull()
    expect(findAudioFile(dir, 'lancer')).toBeNull()
    expect(findAudioFile(join(root, 'absent'), 'menu')).toBeNull()
    expect(findAudioFile('', 'menu')).toBeNull()
  })
})
