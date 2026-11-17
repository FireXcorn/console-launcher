import { existsSync, mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { addRoms } from './romfolder'

describe('ajout de jeux en un geste', () => {
  it('range chaque fichier dans le dossier de sa console et signale les refus', () => {
    const dl = mkdtempSync(join(tmpdir(), 'dl-'))
    const jeux = join(mkdtempSync(join(tmpdir(), 'jeux-')), 'Jeux')
    writeFileSync(join(dl, 'Pokemon Platinum.nds'), 'x')
    writeFileSync(join(dl, 'Pokemon X.3ds'), 'x')
    writeFileSync(join(dl, 'jeu.zip'), 'x')
    writeFileSync(join(dl, 'notes.txt'), 'x')
    const r = addRoms(jeux, ['Pokemon Platinum.nds', 'Pokemon X.3ds', 'jeu.zip', 'notes.txt'].map((f) => join(dl, f)))
    expect(r.added).toEqual(['Pokémon Platine', 'Pokémon X'])
    expect(existsSync(join(jeux, 'Nintendo DS', 'Pokemon Platinum.nds'))).toBe(true)
    expect(existsSync(join(jeux, 'Nintendo 3DS', 'Pokemon X.3ds'))).toBe(true)
    expect(r.skipped).toHaveLength(2)
    expect(r.skipped[0]).toMatch(/compressé/)
    expect(addRoms(jeux, [join(dl, 'Pokemon X.3ds')]).skipped[0]).toMatch(/déjà/)
  })
})
