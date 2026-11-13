import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ConfigStore, parseConfigText } from './config'

let root: string
let file: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'v8-'))
  file = join(root, 'config.json')
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('réglages à l’abri de la corruption', () => {
  it('lit un fichier enregistré avec le caractère invisible (BOM)', () => {
    writeFileSync(file, '\uFEFF' + JSON.stringify({ appTitle: 'Ma console' }))
    const store = new ConfigStore(file)
    expect(store.get().appTitle).toBe('Ma console')
    expect(store.recovery).toBeNull()
    expect(parseConfigText('\uFEFF{"a":1}')).toEqual({ a: 1 })
    expect(parseConfigText('pas du json')).toBeNull()
    expect(parseConfigText('[1,2]')).toBeNull()
  })

  it('n’écrase jamais un fichier illisible : il est mis de côté et les valeurs par défaut sont utilisées', () => {
    writeFileSync(file, '{ abîmé')
    const store = new ConfigStore(file)
    expect(store.recovery).toMatch(/par défaut/)
    expect(readdirSync(root).some((n) => n.startsWith('config.json.casse-'))).toBe(true)
    expect(readFileSync(file, 'utf8')).toBe('{ abîmé') // intact tant qu'on n'enregistre rien
  })

  it('reprend la copie de secours quand le fichier est abîmé', () => {
    const store = new ConfigStore(file)
    store.set({ appTitle: 'Premier' })
    store.set({ appTitle: 'Second' })
    writeFileSync(file, '\u0000\u0000 plus du json')
    const again = new ConfigStore(file)
    expect(again.recovery).toMatch(/copie de secours/)
    expect(again.get().appTitle).toBe('Premier')
  })

  it('enregistre sans laisser de fichier temporaire et garde l’état précédent en copie', () => {
    const store = new ConfigStore(file)
    store.set({ appTitle: 'A' })
    store.set({ appTitle: 'B' })
    expect(existsSync(`${file}.tmp`)).toBe(false)
    expect(JSON.parse(readFileSync(file, 'utf8')).appTitle).toBe('B')
    expect(JSON.parse(readFileSync(`${file}.bak`, 'utf8')).appTitle).toBe('A')
  })

  it('l’assistant du premier lancement n’apparaît pas pour une configuration qui a déjà des jeux', () => {
    expect(new ConfigStore(file).get().onboarded).toBe(false)
    writeFileSync(file, JSON.stringify({ emulated: [{ title: 'X', emulatorExe: 'a', gameFile: '', args: [] }] }))
    expect(new ConfigStore(file).get().onboarded).toBe(true)
    writeFileSync(file, JSON.stringify({ gamesDir: 'C:\\Jeux', launchExe: 'jeu.exe' }))
    expect(new ConfigStore(file).get().onboarded).toBe(true)
    writeFileSync(file, JSON.stringify({ gamesDir: 'C:\\Jeux', launchExe: '' }))
    expect(new ConfigStore(file).get().onboarded).toBe(false)
  })
})
