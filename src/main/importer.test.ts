import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { findPrograms } from './importer'

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'imp-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

const put = (path: string, size = 10): void => {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, 'x'.repeat(size))
}

describe('import d’un dossier de jeux', () => {
  it('trouve un programme par sous-dossier, avec le titre du dossier nettoyé', async () => {
    put(join(root, 'Super Aventure [v1.2]', 'jeu.exe'))
    put(join(root, 'Circuit Turbo', 'bin', 'turbo.exe'))
    const found = await findPrograms(root)
    expect(found.map((f) => f.title)).toEqual(['Circuit Turbo', 'Super Aventure'])
    expect(found[0].exe).toBe(join(root, 'Circuit Turbo', 'bin', 'turbo.exe'))
  })

  it('écarte désinstalleurs, installeurs et rapporteurs d’erreurs', async () => {
    put(join(root, 'Puzzle Lab', 'unins000.exe'), 5000)
    put(join(root, 'Puzzle Lab', 'vc_redist.x64.exe'), 9000)
    put(join(root, 'Puzzle Lab', 'CrashReportClient.exe'), 8000)
    put(join(root, 'Puzzle Lab', 'lab.exe'), 100)
    expect((await findPrograms(root))[0].exe).toBe(join(root, 'Puzzle Lab', 'lab.exe'))
  })

  it('préfère le programme dont le nom ressemble au dossier, sinon le plus gros', async () => {
    put(join(root, 'Royaume Perdu', 'outil.exe'), 9000)
    put(join(root, 'Royaume Perdu', 'royaume.exe'), 100)
    put(join(root, 'Autre Jeu', 'a.exe'), 10)
    put(join(root, 'Autre Jeu', 'b.exe'), 500)
    const found = await findPrograms(root)
    expect(found.find((f) => f.title === 'Royaume Perdu')?.exe).toBe(join(root, 'Royaume Perdu', 'royaume.exe'))
    expect(found.find((f) => f.title === 'Autre Jeu')?.exe).toBe(join(root, 'Autre Jeu', 'b.exe'))
  })

  it('ignore les dossiers sans programme et un dossier inexistant', async () => {
    mkdirSync(join(root, 'Vide'))
    writeFileSync(join(root, 'notes.txt'), 'x')
    expect(await findPrograms(root)).toEqual([])
    expect(await findPrograms(join(root, 'absent'))).toEqual([])
    expect(await findPrograms('')).toEqual([])
  })
})
