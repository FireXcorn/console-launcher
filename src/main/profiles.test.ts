import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ConfigStore, normalizeProfile, normalizeProfiles } from './config'

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'prof-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('profils', () => {
  it('garde un profil valide tel quel et corrige un profil abîmé', () => {
    expect(normalizeProfile({ id: 'a', name: 'Léa', color: '#ff00aa', avatar: 'renard', image: '' }, 'x')).toEqual({
      id: 'a',
      name: 'Léa',
      color: '#ff00aa',
      background: 'c:#ff00aa',
      avatar: 'renard',
      image: ''
    })
    expect(normalizeProfile({ name: '   ', color: 'rouge', id: 7 }, 'p9')).toEqual({
      id: 'p9',
      name: 'Joueur',
      color: '#2f6fe0',
      background: 'c:#2f6fe0',
      avatar: '',
      image: ''
    })
    expect(normalizeProfile(null, 'p1')).toBeNull()
    expect(normalizeProfile('texte', 'p1')).toBeNull()
  })

  it('coupe les noms trop longs', () => {
    expect(normalizeProfile({ name: 'x'.repeat(80) }, 'p1')?.name).toHaveLength(24)
  })

  it('garantit au moins un profil et des identifiants uniques', () => {
    expect(normalizeProfiles({}).profiles).toHaveLength(1)
    const r = normalizeProfiles({ profiles: [{ id: 'a', name: 'A' }, { id: 'a', name: 'B' }, 'abîmé'], activeProfile: 'a' })
    expect(r.profiles.map((p) => p.name)).toEqual(['A', 'B'])
    expect(new Set(r.profiles.map((p) => p.id)).size).toBe(2)
  })

  it('retombe sur le premier profil si le profil actif n’existe plus', () => {
    const r = normalizeProfiles({ profiles: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], activeProfile: 'zzz' })
    expect(r.activeProfile).toBe('a')
    expect(normalizeProfiles({ profiles: [{ id: 'a' }, { id: 'b' }], activeProfile: 'b' }).activeProfile).toBe('b')
  })

  it('relit les profils enregistrés par le lanceur', () => {
    const file = join(root, 'config.json')
    const store = new ConfigStore(file)
    store.set({
      profiles: [
        { id: 'p1', name: 'Moi', color: '#e0252b', background: 'c:#e0252b', avatar: 'chat', image: '' },
        { id: 'p2', name: 'Toi', color: '#3fa34d', background: 'g:ocean', avatar: 'ours', image: '' }
      ],
      activeProfile: 'p2'
    })
    const again = new ConfigStore(file).get()
    expect(again.profiles.map((p) => p.name)).toEqual(['Moi', 'Toi'])
    expect(again.activeProfile).toBe('p2')
  })

  it('ignore un fichier de configuration illisible', () => {
    const file = join(root, 'config.json')
    writeFileSync(file, '{ pas du json')
    expect(new ConfigStore(file).get().profiles).toHaveLength(1)
  })
})
