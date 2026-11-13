import { existsSync, mkdtempSync, readdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { autoBackup, listBackups, parseBackup, pruneBackups, restorePatch, takeSnapshot, writeBackup } from './backup'
import { ConfigStore } from './config'

const tmp = (): string => mkdtempSync(join(tmpdir(), 'sauvegarde-'))
const cfgOf = (dir: string) => ConfigStore.prototype.constructor && new ConfigStore(join(dir, 'config.json')).get()

describe('sauvegarde des joueurs', () => {
  it('une sauvegarde relue donne les mêmes profils, temps de jeu et titres', () => {
    const dir = tmp()
    const cfg = { ...cfgOf(dir), playtime: { 'p1|jeu': 120 }, lastPlayed: { jeu: 5 }, overrides: { jeu: { title: 'Mon jeu' } } }
    const data = takeSnapshot(cfg, 'manuelle', 1000)
    const name = writeBackup(join(dir, 'b'), data)
    expect(listBackups(join(dir, 'b'))).toEqual([{ name, createdAt: 1000, reason: 'manuelle', profiles: [cfg.profiles[0].name] }])
    const read = parseBackup(JSON.stringify(data))
    expect(read?.playtime).toEqual({ 'p1|jeu': 120 })
    expect(read?.titles).toEqual({ jeu: 'Mon jeu' })
  })

  it('refuse ce qui n’est pas une sauvegarde', () => {
    expect(parseBackup('pas du json')).toBeNull()
    expect(parseBackup('{"format":2}')).toBeNull()
    expect(parseBackup('{"format":1,"profiles":[]}')).toBeNull()
  })

  it('sauvegarde automatique : pas de doublon, et une par heure au plus', () => {
    const dir = join(tmp(), 'b')
    const cfg = cfgOf(tmp())
    const t0 = new Date(2026, 0, 1, 10, 0, 0).getTime()
    expect(autoBackup(dir, cfg, t0)).not.toBeNull()
    expect(autoBackup(dir, cfg, t0 + 3 * 3600_000)).toBeNull() // rien n'a changé
    const changed = { ...cfg, playtime: { x: 1 } }
    expect(autoBackup(dir, changed, t0 + 600_000)).toBeNull() // trop tôt
    expect(autoBackup(dir, changed, t0 + 3 * 3600_000)).not.toBeNull()
    expect(listBackups(dir)).toHaveLength(2)
  })

  it('ne garde que les plus récentes', () => {
    const dir = join(tmp(), 'b')
    const cfg = cfgOf(tmp())
    for (let i = 0; i < 5; i++) writeBackup(dir, takeSnapshot(cfg, 'manuelle', 1000 + i * 1000))
    pruneBackups(dir, 2)
    expect(listBackups(dir).map((b) => b.createdAt)).toEqual([5000, 4000])
  })

  it('restaure profils, temps de jeu et photo', () => {
    const dir = tmp()
    const photo = join(dir, 'moi.png')
    writeFileSync(photo, Buffer.from([137, 80, 78, 71]))
    const base = cfgOf(dir)
    const cfg = { ...base, profiles: [{ ...base.profiles[0], name: 'Alex', image: photo }], playtime: { a: 9 } }
    const data = takeSnapshot(cfg, 'x')
    const photos = join(dir, 'photos')
    const patch = restorePatch(data, { ...base, playtime: {} }, photos)
    expect(patch.profiles?.[0].name).toBe('Alex')
    expect(patch.playtime).toEqual({ a: 9 })
    expect(existsSync(patch.profiles![0].image)).toBe(true)
    expect(readdirSync(photos)).toHaveLength(1)
  })
})
