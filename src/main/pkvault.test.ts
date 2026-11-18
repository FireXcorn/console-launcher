import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join, matchesGlob } from 'path'
import { findSaveFile } from './savefile'
import { describe, expect, it } from 'vitest'
import { addSaveGlobs, adoptOldPkvaultData, azaharSdmc, linuxDocumentsDir, pkvaultDir, pkvaultSettingsFile, saveGlobs } from './pkvault'

describe('sauvegardes reconnues par Pokémon Home', () => {
  it('liste les jeux rétro et la 3DS, avec des barres obliques', () => {
    expect(saveGlobs('C:\\Jeux\\', 'C:\\Azahar\\sdmc')).toEqual([
      'C:/Jeux/**/*.sav',
      'C:/Jeux/**/*.dsv',
      'C:/Azahar/sdmc/**/data/00000001/main'
    ])
    expect(saveGlobs('', '')).toEqual([])
  })

  it('le fichier de réglages est au bon endroit selon le système', () => {
    expect(pkvaultSettingsFile(join('a', 'PKVault.exe'), 'win32')).toBe(join('a', 'config', 'pkvault.json'))
    expect(pkvaultSettingsFile(join('a', 'pkvault.AppImage'), 'linux')).toBe(join('a', 'pkvault', 'config', 'pkvault.json'))
    // Linux : PKVAULT_PATH = ce dossier, sinon PKVault prendrait ~/Documents/pkvault et ignorerait ces réglages.
    expect(pkvaultDir(join('a', 'pkvault.AppImage'), 'linux')).toBe(join('a', 'pkvault'))
  })

  it('trouve le dossier Documents de Linux', () => {
    const home = mkdtempSync(join(tmpdir(), 'home-'))
    expect(linuxDocumentsDir(home)).toBe(join(home, 'Documents'))
    mkdirSync(join(home, '.config'))
    writeFileSync(join(home, '.config', 'user-dirs.dirs'), '# x\nXDG_DOCUMENTS_DIR="$HOME/Mes documents"\n')
    expect(linuxDocumentsDir(home)).toBe(home + '/Mes documents')
  })

  it('recopie une fois les Pokémon de l’ancien dossier, sans rien écraser', () => {
    const root = mkdtempSync(join(tmpdir(), 'pkv-'))
    const old = join(root, 'Documents', 'pkvault')
    const now = join(root, 'apps', 'pkvault')
    mkdirSync(join(old, 'db'), { recursive: true })
    mkdirSync(join(old, 'storage'), { recursive: true })
    writeFileSync(join(old, 'db', 'pkvault.db'), 'ancienne')
    writeFileSync(join(old, 'storage', 'Pikachu.pk3'), 'pika')
    mkdirSync(join(now, 'config'), { recursive: true })
    writeFileSync(join(now, 'config', 'pkvault.json'), 'du lanceur')
    expect(adoptOldPkvaultData(old, now)).toBe(true)
    expect(readFileSync(join(now, 'storage', 'Pikachu.pk3'), 'utf8')).toBe('pika')
    expect(readFileSync(join(now, 'config', 'pkvault.json'), 'utf8')).toBe('du lanceur')
    expect(readFileSync(join(old, 'db', 'pkvault.db'), 'utf8')).toBe('ancienne')
    // déjà des données : on ne recopie plus
    writeFileSync(join(old, 'db', 'pkvault.db'), 'plus récente')
    expect(adoptOldPkvaultData(old, now)).toBe(false)
    expect(readFileSync(join(now, 'db', 'pkvault.db'), 'utf8')).toBe('ancienne')
    expect(adoptOldPkvaultData(join(root, 'absent'), join(root, 'autre'))).toBe(false)
  })

  it('crée des réglages complets, puis ajoute sans doublon ni perte', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pkv-'))
    const file = join(dir, 'config', 'pkvault.json')
    expect(addSaveGlobs(file, ['/x/**/*.sav'])).toBe(true)
    const first = JSON.parse(readFileSync(file, 'utf8'))
    expect(first.DB_PATH).toBe('./db') // sans tous les champs, PKVault refuse de démarrer
    expect(first.SAVE_GLOBS).toEqual(['./pokemon-emerald-sample.sav', '/x/**/*.sav'])
    expect(addSaveGlobs(file, ['/x/**/*.sav'])).toBe(false)
    writeFileSync(file, JSON.stringify({ ...first, SAVE_GLOBS: [...first.SAVE_GLOBS, '/perso/*.sav'], LANGUAGE: 'en' }))
    expect(addSaveGlobs(file, ['/y/**/*.sav'])).toBe(true)
    const next = JSON.parse(readFileSync(file, 'utf8'))
    expect(next.SAVE_GLOBS).toEqual(['./pokemon-emerald-sample.sav', '/x/**/*.sav', '/perso/*.sav', '/y/**/*.sav'])
    expect(next.LANGUAGE).toBe('en')
  })

  it('reconnaît de fausses sauvegardes (jeu hors du dossier des jeux, 3DS Azahar), sous tous les systèmes', () => {
    const root = mkdtempSync(join(tmpdir(), 'pkv-fake-'))
    const romsDir = join(root, 'jeux')
    const otherDir = join(root, 'ailleurs', 'GBA')
    const sdmc = azaharSdmc(root, process.platform, join(root, 'AppData'))
    const threeDs = join(sdmc, 'Nintendo 3DS', 'ID0', 'ID1', 'title', '00040000', '00175e00', 'data', '00000001', 'main') // Ultra Lune
    for (const f of [join(romsDir, 'Rouge.sav'), join(otherDir, 'Emeraude.srm'), join(otherDir, 'Rubis.sav'), threeDs]) {
      mkdirSync(dirname(f), { recursive: true })
      writeFileSync(f, 'fausse sauvegarde')
    }
    const globs = saveGlobs(romsDir, sdmc, [otherDir, otherDir])
    const matches = (file: string): boolean => globs.some((g) => matchesGlob(file.replace(/\\/g, '/'), g))
    expect(matches(join(romsDir, 'Rouge.sav'))).toBe(true)
    expect(matches(join(otherDir, 'Emeraude.srm'))).toBe(true)
    expect(matches(join(otherDir, 'Rubis.sav'))).toBe(true)
    expect(matches(threeDs)).toBe(true)
    expect(matches(join(root, 'autre', 'x.sav'))).toBe(false)
    // Le même fichier de jeu mène bien à la même sauvegarde que celle déclarée à PKVault.
    expect(findSaveFile(join(otherDir, 'Rubis.gba'), sdmc)).toBe(join(otherDir, 'Rubis.sav'))
    expect(findSaveFile(join(root, 'Ultra Lune.3ds'), sdmc)).toBe(threeDs)
  })

  it('l’emplacement Azahar suit le système', () => {
    expect(azaharSdmc('/home/u', 'linux')).toBe(join('/home/u', '.local/share/azahar-emu/sdmc'))
    expect(azaharSdmc('C:\\Users\\u', 'win32', 'C:\\R')).toBe(join('C:\\R', 'Azahar', 'sdmc'))
  })

  it('un fichier de réglages illisible n’est pas écrasé', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pkv-'))
    mkdirSync(join(dir, 'config'))
    const file = join(dir, 'config', 'pkvault.json')
    writeFileSync(file, '{ pas du json')
    expect(addSaveGlobs(file, ['/x'])).toBe(false)
    expect(readFileSync(file, 'utf8')).toBe('{ pas du json')
  })
})
