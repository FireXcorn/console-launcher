import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { addSaveGlobs, pkvaultSettingsFile, saveGlobs } from './pkvault'

describe('sauvegardes reconnues par Pokémon Home', () => {
  it('liste les jeux rétro et la 3DS, avec des barres obliques', () => {
    expect(saveGlobs('C:\\Jeux\\', 'C:\\Azahar\\sdmc')).toEqual([
      'C:/Jeux/**/*.sav',
      'C:/Jeux/**/*.dsv',
      'C:/Azahar/sdmc/**/data/00000001.sav'
    ])
    expect(saveGlobs('', '')).toEqual([])
  })

  it('le fichier de réglages est au bon endroit selon le système', () => {
    expect(pkvaultSettingsFile(join('a', 'PKVault.exe'), 'win32')).toBe(join('a', 'config', 'pkvault.json'))
    expect(pkvaultSettingsFile(join('a', 'pkvault.AppImage'), 'linux')).toBe(join('a', 'pkvault', 'config', 'pkvault.json'))
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

  it('un fichier de réglages illisible n’est pas écrasé', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pkv-'))
    mkdirSync(join(dir, 'config'))
    const file = join(dir, 'config', 'pkvault.json')
    writeFileSync(file, '{ pas du json')
    expect(addSaveGlobs(file, ['/x'])).toBe(false)
    expect(readFileSync(file, 'utf8')).toBe('{ pas du json')
  })
})
