import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearProfilePlaytime, playtimeKey, profilePlaytime } from '../shared/playtime'
import { characterName, listCharacterFiles, resolveCharacterFile } from './characters'
import { normalizeProfile, safeAvatar, safeBackground } from './config'

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'v5-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('avatar et arrière-plan d’un profil', () => {
  it('accepte une créature ou une image du dossier, refuse le reste', () => {
    expect(safeAvatar('renard')).toBe('renard')
    expect(safeAvatar('file:Serie/perso.png')).toBe('file:Serie/perso.png')
    expect(safeAvatar('file:../secret.png')).toBe('')
    expect(safeAvatar('file:C:/Windows/x.png')).toBe('')
    expect(safeAvatar('file:/etc/passwd')).toBe('')
    expect(safeAvatar('file:a//b.png')).toBe('')
    expect(safeAvatar('a b')).toBe('')
    expect(safeAvatar(42)).toBe('')
  })

  it('reconnaît uni, dégradé et motif, sinon retombe sur la couleur', () => {
    expect(safeBackground('c:#aabbcc', '#111111')).toBe('c:#aabbcc')
    expect(safeBackground('g:ocean', '#111111')).toBe('g:ocean')
    expect(safeBackground('p:pois', '#111111')).toBe('p:pois')
    expect(safeBackground('url(http://x)', '#111111')).toBe('c:#111111')
    expect(safeBackground(undefined, '#111111')).toBe('c:#111111')
  })

  it('migre l’ancienne couleur vers un arrière-plan uni', () => {
    expect(normalizeProfile({ id: 'a', name: 'Moi', color: '#d6478f' }, 'p1')?.background).toBe('c:#d6478f')
    expect(normalizeProfile({ id: 'a', color: '#d6478f', background: 'g:nuit' }, 'p1')?.background).toBe('g:nuit')
  })
})

describe('dossier de personnages', () => {
  it('range les images : dossier lui-même, puis une série par sous-dossier', async () => {
    mkdirSync(join(root, 'Aventuriers'))
    mkdirSync(join(root, 'Vide'))
    writeFileSync(join(root, 'solo.png'), 'x')
    writeFileSync(join(root, 'notes.txt'), 'x')
    writeFileSync(join(root, 'Aventuriers', 'chevalier_bleu.jpg'), 'x')
    writeFileSync(join(root, 'Aventuriers', 'archer.webp'), 'x')
    const series = await listCharacterFiles(root)
    expect(series.map((s) => s.series)).toEqual(['', 'Aventuriers'])
    expect(series[0].files.map((f) => f.id)).toEqual(['file:solo.png'])
    expect(series[1].files.map((f) => f.id)).toEqual(['file:Aventuriers/archer.webp', 'file:Aventuriers/chevalier_bleu.jpg'])
    expect(series[1].files[1].name).toBe('chevalier bleu')
  })

  it('renvoie une liste vide si le dossier est absent', async () => {
    expect(await listCharacterFiles(join(root, 'absent'))).toEqual([])
    expect(await listCharacterFiles('')).toEqual([])
  })

  it('ne résout que des fichiers situés dans le dossier', () => {
    expect(resolveCharacterFile(root, 'file:Serie/a.png')).toBe(join(root, 'Serie', 'a.png'))
    expect(resolveCharacterFile(root, 'file:../a.png')).toBeNull()
    expect(resolveCharacterFile(root, 'file:a.txt')).toBeNull()
    expect(resolveCharacterFile(root, 'renard')).toBeNull()
    expect(resolveCharacterFile('', 'file:a.png')).toBeNull()
  })

  it('met en forme le nom d’un fichier', () => {
    expect(characterName('mon_perso-prefere.PNG')).toBe('mon perso prefere')
  })
})

describe('temps de jeu par utilisateur', () => {
  const config = {
    profiles: [
      { id: 'a', name: 'A', color: '#000000', background: 'c:#000000', avatar: '', image: '' },
      { id: 'b', name: 'B', color: '#000000', background: 'c:#000000', avatar: '', image: '' }
    ],
    playtime: { jeu1: 100, [playtimeKey('a', 'jeu1')]: 20, [playtimeKey('b', 'jeu1')]: 5, jeu2: 7 }
  }

  it('attribue l’ancien décompte commun au premier profil', () => {
    expect(profilePlaytime(config, 'a', 'jeu1')).toBe(120)
    expect(profilePlaytime(config, 'b', 'jeu1')).toBe(5)
    expect(profilePlaytime(config, 'b', 'jeu2')).toBe(0)
  })

  it('supprime l’activité d’un seul utilisateur', () => {
    expect(clearProfilePlaytime(config, 'b')).toEqual({ jeu1: 100, [playtimeKey('a', 'jeu1')]: 20, jeu2: 7 })
    expect(clearProfilePlaytime(config, 'a')).toEqual({ [playtimeKey('b', 'jeu1')]: 5 })
  })
})
