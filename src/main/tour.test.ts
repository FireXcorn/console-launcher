import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { ConfigStore } from './config'
import { loadRecipes } from './recipes'

const fileIn = (): string => join(mkdtempSync(join(tmpdir(), 'visite-')), 'config.json')

describe('visite guidée du premier lancement', () => {
  it('un nouvel utilisateur a la visite ; qui a déjà des jeux ne l’a pas', () => {
    const fresh = fileIn()
    expect(new ConfigStore(fresh).get().tourDone).toBe(false)
    const old = fileIn()
    writeFileSync(old, JSON.stringify({ emulated: [{ title: 'X', emulatorExe: 'a', gameFile: '', args: [] }] }))
    expect(new ConfigStore(old).get().tourDone).toBe(true)
  })

  it('une visite déjà terminée le reste', () => {
    const f = fileIn()
    writeFileSync(f, JSON.stringify({ onboarded: false, tourDone: true }))
    expect(new ConfigStore(f).get().tourDone).toBe(true)
  })

  it('chaque recette livrée dit quoi apporter', () => {
    for (const r of loadRecipes(join(__dirname, '../../recipes'))) expect(r.guide, r.id).toBeTruthy()
  })
})
