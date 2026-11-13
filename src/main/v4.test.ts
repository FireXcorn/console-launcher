import { describe, expect, it } from 'vitest'
import { LINKS } from '../shared/links'
import { isAllowedExternal } from './system'

describe('barre du bas et liens', () => {
  it('n’ouvre que des adresses https autorisées', () => {
    for (const url of Object.values(LINKS)) expect(isAllowedExternal(url)).toBe(true)
  })

  it('les adresses ne contiennent aucune donnée personnelle (ni paramètre, ni identifiant)', () => {
    for (const url of Object.values(LINKS)) {
      expect(new URL(url).search).toBe('')
      expect(url).not.toMatch(/@/)
    }
  })
})
