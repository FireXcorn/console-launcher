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

describe('jeux Pokémon du catalogue', () => {
  it('liste les 30 entrées, chacune avec un émulateur connu, sans doublon', async () => {
    const { pokemonEntries } = await import('./catalog')
    const { EMULATORS } = await import('../shared/emulators')
    const entries = pokemonEntries([])
    expect(entries).toHaveLength(30)
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length)
    expect(entries.every((e) => e.emulatorId && EMULATORS[e.emulatorId])).toBe(true)
    expect(entries[0].title).toBe('Pokémon Ultra-Soleil')
    expect(entries.every((e) => e.id.startsWith('catalog:'))).toBe(true)
  })
  it('écarte un jeu déjà ajouté sous le même titre', async () => {
    const { pokemonEntries } = await import('./catalog')
    expect(pokemonEntries(['Pokémon Émeraude']).some((e) => e.title === 'Pokémon Émeraude')).toBe(false)
  })
})

describe('dossier des jeux', () => {
  it('reconnaît les jeux Pokémon d\'après leur nom de fichier (français et anglais)', async () => {
    const { titleForRom } = await import('./romfolder')
    const cas: Array<[string, string]> = [
      ['Pokemon - Version Rouge (France) (SGB Enhanced).gb', 'Pokémon Rouge'],
      ['Pokemon - Version Rouge Feu (France).gba', 'Pokémon Rouge Feu'],
      ['Pokemon - Version Or HeartGold (France).nds', 'Pokémon Or HeartGold'],
      ['Pokemon - Version Argent SoulSilver (France).nds', 'Pokémon Argent SoulSilver'],
      ['Pokemon - Version Or (France) (SGB Enhanced) (GB Compatible).gbc', 'Pokémon Or'],
      ['Pokemon - Version Noire 2 (France) (NDSi Enhanced).nds', 'Pokémon Noire 2'],
      ['Pokemon - Version Blanche (France) (NDSi Enhanced).nds', 'Pokémon Blanche'],
      ['Pokemon - Version Diamant (France) (Rev 5).nds', 'Pokémon Diamant'],
      ['Pokemon X (USA) (En,Ja,Fr,De,Es,It,Ko).3ds', 'Pokémon X'],
      ['Pokemon Y (Europe) (En,Ja,Fr,De,Es,It,Ko).3ds', 'Pokémon Y'],
      ['Pokemon Omega Ruby (Europe) (En,Ja,Fr,De,Es,It,Ko) (Rev 2).3ds', 'Pokémon Rubis Oméga'],
      ['Pokemon Ultra Moon (Europe) (En,Ja,Fr,De,Es,It,Zh,Ko).3ds', 'Pokémon Ultra-Lune'],
      ['Pokemon Sun (Europe) (En,Ja,Fr,De,Es,It,Zh,Ko).3ds', 'Pokémon Soleil'],
      ['Pokemon Emerald (USA).gba', 'Pokémon Émeraude'],
      ['Inazuma Eleven 3 - Bomb Blast (Europe) (En,Es,It).3ds', 'Inazuma Eleven 3 - Bomb Blast']
    ]
    for (const [fichier, titre] of cas) expect(titleForRom(fichier)).toBe(titre)
  })
  it('crée les dossiers par console et ne trouve que les fichiers de jeu', async () => {
    const { ensureRomFolder, listRoms, romEntries } = await import('./romfolder')
    const { mkdtempSync, writeFileSync, existsSync, mkdirSync } = await import('fs')
    const { tmpdir } = await import('os')
    const root = mkdtempSync(join(tmpdir(), 'jeux-'))
    ensureRomFolder(root)
    expect(existsSync(join(root, 'Nintendo 3DS'))).toBe(true)
    writeFileSync(join(root, 'Game Boy', 'Pokemon - Version Jaune (France).gb'), '')
    writeFileSync(join(root, 'Game Boy', 'notes.txt'), '')
    mkdirSync(join(root, 'vrac'), { recursive: true })
    writeFileSync(join(root, 'vrac', 'Pokemon - Version Jaune (France).gbc'), '')
    expect(listRoms(root)).toHaveLength(2)
    const jeux = romEntries(root, (id) => (id === 'mgba' ? 'mgba.exe' : undefined))
    expect(jeux).toHaveLength(1)
    expect(jeux[0]).toMatchObject({ title: 'Pokémon Jaune', emulatorExe: 'mgba.exe', args: ['-f', '{game}'] })
  })
})
