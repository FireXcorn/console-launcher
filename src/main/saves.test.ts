import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import type { Recipe } from './recipes'
import { GameSaves, resolveSaveDirs, saveRulesFor } from './saves'

const setup = () => {
  const base = mkdtempSync(join(tmpdir(), 'saves-'))
  const live = join(base, 'jeu', 'save')
  const saves = new GameSaves(join(base, 'rangement'))
  const write = (file: string, text: string): void => {
    mkdirSync(live, { recursive: true })
    writeFileSync(join(live, file), text)
  }
  const read = (file: string): string | null => (existsSync(join(live, file)) ? readFileSync(join(live, file), 'utf8') : null)
  return { base, live, saves, write, read }
}

describe('sauvegardes de jeu par profil', () => {
  it('chaque profil retrouve sa partie, un nouveau profil repart de zéro', () => {
    const { live, saves, write, read } = setup()
    write('slot', 'partie de Ismail') // existait déjà avant la fonction
    expect(saves.prepare('ismail', 'jeu', [live])).toBe('adopté')
    write('slot', 'Ismail niveau 2')
    expect(saves.collect('ismail', 'jeu', [live])).toBe(true)

    expect(saves.prepare('assia', 'jeu', [live])).toBe('neuf')
    expect(read('slot')).toBeNull()
    write('slot', 'Assia niveau 1')
    saves.collect('assia', 'jeu', [live])

    expect(saves.prepare('ismail', 'jeu', [live])).toBe('restauré')
    expect(read('slot')).toBe('Ismail niveau 2')
    saves.collect('ismail', 'jeu', [live])
    expect(saves.prepare('assia', 'jeu', [live])).toBe('restauré')
    expect(read('slot')).toBe('Assia niveau 1')
  })

  it('le même profil relancé ne change rien', () => {
    const { live, saves, write } = setup()
    write('slot', 'a')
    saves.prepare('p1', 'jeu', [live])
    expect(saves.prepare('p1', 'jeu', [live])).toBe('inchangé')
  })

  it('range la partie de l’autre joueur et garde une copie de sécurité avant de la remplacer', () => {
    const { base, live, saves, write } = setup()
    write('slot', 'v1')
    saves.prepare('p1', 'jeu', [live])
    write('slot', 'v2 non collectée') // le jeu s'est fermé sans passage par collect
    saves.prepare('p2', 'jeu', [live])
    expect(saves.profilesWithSaves('jeu')).toEqual(['p1'])
    expect(readdirSync(join(base, 'rangement', 'jeu', 'avant-remplacement'))).toHaveLength(1)
    expect(readFileSync(join(base, 'rangement', 'jeu', 'profils', 'p1', '0', 'slot'), 'utf8')).toBe('v2 non collectée')
  })

  it('ne range pas pour un profil qui n’est pas le propriétaire, et ne perd rien si le dossier manque', () => {
    const { live, saves, write } = setup()
    write('slot', 'a')
    saves.prepare('p1', 'jeu', [live])
    expect(saves.collect('p2', 'jeu', [live])).toBe(false)
    expect(saves.collect('p1', 'jeu', [join(live, 'inexistant')])).toBe(true)
    expect(saves.prepare('p2', 'jeu', [live])).toBe('neuf')
    expect(saves.prepare('p1', 'jeu', [live])).toBe('restauré')
  })
})

describe('règles de sauvegarde', () => {
  const recipe = { id: 'x', title: 'Mon Jeu', tool: 't', exe: 'e', saves: ['save', '{appdata}/outil/user'] } as Recipe
  it('trouve les règles par titre (accents et casse ignorés)', () => {
    expect(saveRulesFor(['', 'mon jeu'], [recipe])).toEqual(['save', '{appdata}/outil/user'])
    expect(saveRulesFor(['Autre'], [recipe])).toEqual([])
  })
  it('résout les chemins relatifs et les jetons', () => {
    const dirs = resolveSaveDirs(recipe.saves!, 'C:/Jeux/X', { appdata: 'C:/Roaming', localappdata: '', userprofile: '' }).map((d) => d.split('\\').join('/'))
    expect(dirs).toEqual(['C:/Jeux/X/save', 'C:/Roaming/outil/user'])
  })
})
