import { mkdirSync, mkdtempSync, writeFileSync, existsSync, statSync } from 'fs'
import { tmpdir } from 'os'
import { basename, join } from 'path'
import { describe, expect, it } from 'vitest'
import { APPS, type AppDef, appInfo, findExe, installApp, launchPath, removeApp } from './apps'

// Application factice : le chemin « téléchargé puis choisi » reste testé même si toutes les applis réelles sont livrées.
const pkhex: AppDef = {
  id: 'pkhex',
  title: 'Test',
  description: '',
  page: 'https://example.org',
  exe: 'PKHeX.exe',
  fileHint: 'le fichier PKHeX.exe',
  platforms: ['win32']
}
const pkvault = APPS.find((a) => a.id === 'pkvault')!

describe('applis', () => {
  it('trouve le programme dans un sous-dossier, sans tenir compte des majuscules', () => {
    const dir = mkdtempSync(join(tmpdir(), 'applis-'))
    mkdirSync(join(dir, 'a', 'b'), { recursive: true })
    writeFileSync(join(dir, 'a', 'b', 'pkhex.EXE'), 'x')
    expect(findExe(dir, 'PKHeX.exe')).toBe(join(dir, 'a', 'b', 'pkhex.EXE'))
    expect(findExe(join(dir, 'vide'), 'PKHeX.exe')).toBeNull()
  })

  it('un programme livré est copié et rendu exécutable avant le lancement', () => {
    const root = mkdtempSync(join(tmpdir(), 'applis-'))
    const emu = mkdtempSync(join(tmpdir(), 'emu-'))
    const rel = pkvault.bundled![process.platform]!
    expect(launchPath(pkvault, root, emu)).toBeNull()
    mkdirSync(join(emu, rel, '..'), { recursive: true })
    writeFileSync(join(emu, rel), 'x')
    expect(appInfo(pkvault, root, emu)).toMatchObject({ installed: true, bundled: true })
    const exe = launchPath(pkvault, root, emu)!
    expect(exe).toBe(join(root, 'pkvault', basename(rel)))
    if (process.platform !== 'win32') expect(statSync(exe).mode & 0o111).toBeTruthy()
  })

  it('installe le programme choisi, refuse un autre fichier, puis le retire', async () => {
    if (process.platform !== 'win32') return
    const root = mkdtempSync(join(tmpdir(), 'applis-'))
    const dl = mkdtempSync(join(tmpdir(), 'dl-'))
    writeFileSync(join(dl, 'PKHeX.exe'), 'x')
    writeFileSync(join(dl, 'autre.txt'), 'x')
    expect(appInfo(pkhex, root).installed).toBe(false)
    expect(await installApp(pkhex, root, join(dl, 'autre.txt'))).toMatch(/Choisis/)
    expect(await installApp(pkhex, root, join(dl, 'PKHeX.exe'))).toBeNull()
    expect(appInfo(pkhex, root).installed).toBe(true)
    removeApp(pkhex, root)
    expect(existsSync(join(root, 'pkhex'))).toBe(false)
  })
})
