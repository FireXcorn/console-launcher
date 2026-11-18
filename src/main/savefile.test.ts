import { mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { backupSave, findSaveFile } from './savefile'

describe('trouver la sauvegarde d’un jeu', () => {
  it('jeu rétro : le .sav du même nom, sans tenir compte des majuscules', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sav-'))
    writeFileSync(join(dir, 'Emeraude.gba'), 'x')
    expect(findSaveFile(join(dir, 'Emeraude.gba'), '')).toBeNull()
    writeFileSync(join(dir, 'EMERAUDE.SAV'), 'x')
    expect(findSaveFile(join(dir, 'Emeraude.gba'), '')).toBe(join(dir, 'EMERAUDE.SAV'))
  })

  it('3DS : la sauvegarde la plus récente du dossier sdmc', () => {
    const sdmc = mkdtempSync(join(tmpdir(), 'sdmc-'))
    const a = join(sdmc, 'Nintendo 3DS', 'x', 'y', 'title', '00040000', 'aaa', 'data', '00000001')
    const b = join(sdmc, 'Nintendo 3DS', 'x', 'y', 'title', '00040000', 'bbb', 'data', '00000001')
    for (const d of [a, b]) mkdirSync(d, { recursive: true })
    writeFileSync(join(a, 'main'), 'a')
    writeFileSync(join(b, 'main'), 'b')
    utimesSync(join(a, 'main'), new Date(2026, 1, 1), new Date(2026, 1, 1))
    expect(findSaveFile('jeu.3ds', sdmc)).toBe(join(b, 'main'))
    expect(findSaveFile('jeu.3ds', join(sdmc, 'absent'))).toBeNull()
  })
})

describe('copie de secours d’une sauvegarde', () => {
  it('une copie par jeu, la dernière écrase la précédente ; le `main` 3DS garde un nom lisible', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bak-'))
    const sav = join(dir, 'Emeraude.sav')
    writeFileSync(sav, 'v1')
    const dest = join(dir, 'copies')
    expect(backupSave(sav, dest, 'Pokémon Émeraude')).toBe(join(dest, 'Pokémon Émeraude.sav'))
    writeFileSync(sav, 'v2')
    backupSave(sav, dest, 'Pokémon Émeraude')
    expect(readFileSync(join(dest, 'Pokémon Émeraude.sav'), 'utf8')).toBe('v2')
    const main = join(dir, 'main')
    writeFileSync(main, '3ds')
    expect(backupSave(main, dest, 'Pokémon Ultra-Lune')).toBe(join(dest, 'Pokémon Ultra-Lune.main'))
    expect(backupSave(sav, dest, '..')).toBeNull()
    expect(backupSave(sav, dest, 'a/b:c')).toBe(join(dest, 'a b c.sav'))
  })
})