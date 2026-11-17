import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { findSaveFile } from './savefile'

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
    const a = join(sdmc, 'Nintendo 3DS', 'x', 'y', 'title', '00040000', 'aaa', 'data')
    const b = join(sdmc, 'Nintendo 3DS', 'x', 'y', 'title', '00040000', 'bbb', 'data')
    for (const d of [a, b]) mkdirSync(d, { recursive: true })
    writeFileSync(join(a, '00000001.sav'), 'a')
    writeFileSync(join(b, '00000001.sav'), 'b')
    utimesSync(join(a, '00000001.sav'), new Date(2026, 1, 1), new Date(2026, 1, 1))
    expect(findSaveFile('jeu.3ds', sdmc)).toBe(join(b, '00000001.sav'))
    expect(findSaveFile('jeu.3ds', join(sdmc, 'absent'))).toBeNull()
  })
})
