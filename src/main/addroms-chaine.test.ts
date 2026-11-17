import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { scanLibrary } from './library'
import { addRoms, romEntries, titleForRom } from './romfolder'

/**
 * Chemin complet d'un jeu ajouté par « Ajouter mes jeux » (sélecteur ou glisser-déposer : les deux appellent addRoms),
 * jusqu'à la tuile et à la ligne de commande de l'émulateur. Seul Electron (dialogue, webUtils) n'est pas simulé.
 */
function setup(): { dl: string; jeux: string; emu: (id: string) => string | undefined } {
  const dl = mkdtempSync(join(tmpdir(), 'dl '))
  const jeux = join(mkdtempSync(join(tmpdir(), 'jeux-')), 'Jeux')
  const emuDir = mkdtempSync(join(tmpdir(), 'emu-'))
  const exes: Record<string, string> = {}
  for (const id of ['mgba', 'melonds', 'azahar']) {
    exes[id] = join(emuDir, id)
    writeFileSync(exes[id], '')
  }
  return { dl, jeux, emu: (id) => exes[id] }
}

const scan = (emulated: ReturnType<typeof romEntries>): ReturnType<typeof scanLibrary> =>
  scanLibrary({ gamesDir: '', launchExe: '', launchArgs: [], overrides: {}, lastPlayed: {}, emulated })

const put = (dir: string, names: string[]): string[] =>
  names.map((n) => {
    writeFileSync(join(dir, n), 'x')
    return join(dir, n)
  })

describe('jeu ajouté → tuile → lancement', () => {
  it('un fichier au nom réel (espaces, parenthèses, majuscules) devient une tuile lançable', async () => {
    const { dl, jeux, emu } = setup()
    const [src] = put(dl, ['Pokemon - Platinum Version (USA) (Rev 1).NDS'])
    expect((await addRoms(jeux, [src])).added).toEqual(['Pokémon Platine'])
    const [game] = await scan(romEntries(jeux, emu))
    const copied = join(jeux, 'Nintendo DS', 'Pokemon - Platinum Version (USA) (Rev 1).NDS')
    expect(game).toMatchObject({ title: 'Pokémon Platine', exePath: emu('melonds'), emulated: true })
    // Le chemin du jeu reste un seul argument, même avec des espaces.
    expect(game.args).toEqual([copied])
  })

  it('3DS et GBA passent -f puis le fichier', async () => {
    const { dl, jeux, emu } = setup()
    await addRoms(jeux, put(dl, ['Pokemon X.3ds', 'Pokemon - Emerald Version (USA, Europe).gba']))
    const games = await scan(romEntries(jeux, emu))
    expect(games).toHaveLength(2)
    for (const g of games) expect(g.args[0]).toBe('-f')
    expect(games.map((g) => g.title)).toEqual(expect.arrayContaining(['Pokémon Émeraude', 'Pokémon X']))
  })

  it('un fichier disparu entre l’ajout et le lancement retire la tuile au lieu de lancer l’émulateur à vide', async () => {
    const { jeux, emu } = setup()
    const ghost = [{ title: 'Fantôme', emulatorExe: emu('mgba')!, gameFile: join(jeux, 'absent.gba'), args: ['-f', '{game}'], readyTitle: '.' }]
    expect(await scan(ghost)).toEqual([])
  })

  it('les noms No-Intro de Noire 2 et Blanche 2 sont reconnus', () => {
    expect(titleForRom('Pokemon - Black Version 2 (USA, Europe) (NDSi Enhanced).nds')).toBe('Pokémon Noire 2')
    expect(titleForRom('Pokemon - White Version 2 (USA, Europe) (NDSi Enhanced).nds')).toBe('Pokémon Blanche 2')
    expect(titleForRom('Pokemon - Version Noire 2 (France).nds')).toBe('Pokémon Noire 2')
    expect(titleForRom('Pokemon - Black Version (USA, Europe).nds')).toBe('Pokémon Noire')
  })

  it('les jeux dérivés gardent leur nom au lieu de prendre celui d’un jeu principal', () => {
    expect(titleForRom('Pokemon Mystery Dungeon - Red Rescue Team (USA, Australia).gba')).toBe('Pokemon Mystery Dungeon - Red Rescue Team')
    expect(titleForRom('Pokemon Mystery Dungeon - Blue Rescue Team (USA).nds')).toBe('Pokemon Mystery Dungeon - Blue Rescue Team')
    expect(titleForRom('Pokemon Pinball - Ruby & Sapphire (USA).gba')).toBe('Pokemon Pinball - Ruby & Sapphire')
    expect(titleForRom('Pokemon - FireRed Version (USA, Europe) (Rev 1).gba')).toBe('Pokémon Rouge Feu')
  })

  it('Noire et Noire 2 ajoutés ensemble donnent deux tuiles', async () => {
    const { dl, jeux, emu } = setup()
    const r = await addRoms(jeux, put(dl, ['Pokemon - Black Version (USA, Europe).nds', 'Pokemon - Black Version 2 (USA, Europe).nds']))
    expect(r.added).toEqual(['Pokémon Noire', 'Pokémon Noire 2'])
    expect(await scan(romEntries(jeux, emu))).toHaveLength(2)
  })

  it('un deuxième fichier du même jeu (autre région) est signalé au lieu d’être annoncé ajouté', async () => {
    const { dl, jeux, emu } = setup()
    const r = await addRoms(jeux, put(dl, ['Pokemon - Emerald Version (USA, Europe).gba', 'Pokemon - Version Emeraude (France).gba']))
    expect(r.added).toEqual(['Pokémon Émeraude'])
    expect(r.skipped[0]).toMatch(/déjà dans tes jeux/)
    expect(await scan(romEntries(jeux, emu))).toHaveLength(1)
    expect(readdirSync(join(jeux, 'Game Boy Advance'))).toHaveLength(1)
  })

  it('un titre déjà ajouté à la main est signalé', async () => {
    const { dl, jeux } = setup()
    const r = await addRoms(jeux, put(dl, ['Pokemon X.3ds']), { takenTitles: ['Pokémon X'] })
    expect(r.added).toEqual([])
    expect(r.skipped[0]).toMatch(/déjà dans tes jeux/)
  })

  it('sans l’émulateur de la console, le jeu est copié mais l’utilisateur est prévenu', async () => {
    const { dl, jeux } = setup()
    const r = await addRoms(jeux, put(dl, ['Pokemon X.3ds']), { hasEmulator: (id) => id !== 'azahar' })
    expect(r.added).toEqual([])
    expect(r.skipped[0]).toMatch(/Azahar.*manque/)
    expect(existsSync(join(jeux, 'Nintendo 3DS', 'Pokemon X.3ds'))).toBe(true)
  })

  it('une copie ratée ne laisse ni jeu à moitié copié ni fichier .part', async () => {
    const { dl, jeux } = setup()
    const r = await addRoms(jeux, [join(dl, 'absent.nds')])
    expect(r.skipped[0]).toMatch(/copie impossible/)
    expect(readdirSync(join(jeux, 'Nintendo DS'))).toEqual([])
    // Le même fichier, une fois disponible, peut être ajouté.
    expect((await addRoms(jeux, put(dl, ['absent.nds']))).added).toHaveLength(1)
  })

  it('un dossier glissé est parcouru', async () => {
    const { dl, jeux } = setup()
    const folder = join(dl, 'Mes jeux')
    mkdirSync(join(folder, 'DS'), { recursive: true })
    put(join(folder, 'DS'), ['Pokemon Platinum.nds'])
    put(folder, ['Pokemon Y.3ds', 'lisez-moi.txt', 'archive.zip'])
    const r = await addRoms(jeux, [folder])
    expect(r.added.sort()).toEqual(['Pokémon Platine', 'Pokémon Y'])
    expect(r.skipped).toHaveLength(1)
    expect(r.skipped[0]).toMatch(/compressé/)
    const empty = join(dl, 'Vide')
    mkdirSync(empty)
    expect((await addRoms(jeux, [empty])).skipped[0]).toMatch(/aucun jeu/)
  })
})
