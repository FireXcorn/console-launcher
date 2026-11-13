import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BUILTIN_THEMES, isThemeId, normalizeTheme, safeWallpaperName, themeSlug, themeVars } from '../shared/theme'
import { freeThemeId, importTheme, listThemes, saveTheme, wallpaperPath } from './themes'

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'themes-'))
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('thèmes : valeurs sûres', () => {
  it('rejette les noms de fond qui sortent du dossier', () => {
    expect(safeWallpaperName('fond.png')).toBe('fond.png')
    expect(safeWallpaperName('../fond.png')).toBe('')
    expect(safeWallpaperName('C:\\x\\fond.png')).toBe('')
    expect(safeWallpaperName('sous/fond.png')).toBe('')
    expect(safeWallpaperName('script.exe')).toBe('')
  })

  it('normalise un fichier non fiable', () => {
    const t = normalizeTheme(
      { name: ' Mon thème ', base: 'dark', colors: { bg: '#112233', accent: 'rouge', text: 5 }, tileRadius: 99, wallpaperDim: -1, dockStyle: 'x' },
      'mon-theme'
    )
    expect(t).toMatchObject({ id: 'mon-theme', name: 'Mon thème', base: 'dark', tileRadius: 3, wallpaperDim: 0, dockStyle: 'bar' })
    expect(t.colors).toEqual({ bg: '#112233' })
  })

  it('fabrique des identifiants de dossier valides', () => {
    expect(themeSlug('Été  Rose !')).toBe('ete-rose')
    expect(themeSlug('???')).toBe('theme')
    expect(isThemeId('ete-rose')).toBe(true)
    expect(isThemeId('../x')).toBe(false)
    expect(isThemeId('A')).toBe(false)
  })

  it('traduit un thème en variables CSS', () => {
    const vars = themeVars({ ...BUILTIN_THEMES[0], colors: { accent: '#ff0000' }, tileRadius: 2 })
    expect(vars['--accent']).toBe('#ff0000')
    expect(vars['--tile-radius']).toBe('2')
    expect(vars['--bg']).toBeUndefined()
  })
})

describe('thèmes : dossier', () => {
  it('enregistre, relit et copie le fond sous un nom simple', () => {
    const img = join(root, 'source.PNG')
    writeFileSync(img, 'png')
    const saved = saveTheme(root, { ...BUILTIN_THEMES[0], id: '', name: 'Océan', wallpaper: 'source.PNG' }, img)
    expect(saved.id).toBe('ocean')
    expect(saved.wallpaper).toBe('wallpaper.png')
    expect(existsSync(join(root, 'ocean', 'wallpaper.png'))).toBe(true)
    expect(listThemes(root).map((t) => t.id)).toEqual(['ocean'])
    expect(wallpaperPath(root, saved)).toBe(join(root, 'ocean', 'wallpaper.png'))
    expect(wallpaperPath(root, { ...saved, wallpaper: '../x.png' })).toBeNull()
  })

  it('ne réécrit jamais un thème fourni et évite les doublons', () => {
    expect(freeThemeId(root, 'Clair')).toBe('clair-2')
    const copy = saveTheme(root, { ...BUILTIN_THEMES[1] })
    expect(copy.id).toBe('sombre-2')
    const again = saveTheme(root, { ...copy, name: 'Sombre bis' })
    expect(again.id).toBe('sombre-2')
  })

  it('ignore un theme.json trop gros ou invalide', () => {
    mkdirSync(join(root, 'casse'))
    writeFileSync(join(root, 'casse', 'theme.json'), '{pas du json')
    mkdirSync(join(root, 'gros'))
    writeFileSync(join(root, 'gros', 'theme.json'), JSON.stringify({ name: 'x'.repeat(100_000) }))
    expect(listThemes(root)).toEqual([])
  })

  it('importe un dossier : fond et sons reconnus seulement', () => {
    const src = join(root, 'src-theme')
    mkdirSync(join(src, 'sounds'), { recursive: true })
    writeFileSync(join(src, 'theme.json'), JSON.stringify({ name: 'Import', wallpaper: 'bg.jpg', sounds: true }))
    writeFileSync(join(src, 'bg.jpg'), 'jpg')
    writeFileSync(join(src, 'virus.exe'), 'x')
    writeFileSync(join(src, 'sounds', 'valider.wav'), 'wav')
    writeFileSync(join(src, 'sounds', 'autre.wav'), 'wav')
    const dest = join(root, 'dest')
    mkdirSync(dest)
    const t = importTheme(dest, src)
    expect(t?.id).toBe('import')
    expect(readFileSync(join(dest, 'import', 'bg.jpg'), 'utf8')).toBe('jpg')
    expect(existsSync(join(dest, 'import', 'virus.exe'))).toBe(false)
    expect(existsSync(join(dest, 'import', 'sounds', 'valider.wav'))).toBe(true)
    expect(existsSync(join(dest, 'import', 'sounds', 'autre.wav'))).toBe(false)
    expect(importTheme(dest, join(root, 'vide'))).toBeNull()
  })
})
