import { describe, expect, it } from 'vitest'
import { hostAllowed } from './webapp'

describe('sites affichés dans le lanceur', () => {
  const hosts = ['youtube.com', 'google.com']
  it('seuls les sites autorisés, en https, sont permis', () => {
    expect(hostAllowed('https://www.youtube.com/tv', hosts)).toBe(true)
    expect(hostAllowed('https://accounts.google.com/signin', hosts)).toBe(true)
    expect(hostAllowed('http://www.youtube.com/', hosts)).toBe(false)
    expect(hostAllowed('https://evilyoutube.com/', hosts)).toBe(false)
    expect(hostAllowed('https://youtube.com.evil.org/', hosts)).toBe(false)
    expect(hostAllowed('pas une adresse', hosts)).toBe(false)
  })

  it('« nom.* » accepte toutes les fins d’adresse d’un site qui déménage', () => {
    const wild = ['anime-sama.*']
    for (const u of ['https://anime-sama.to/', 'https://anime-sama.tv/x', 'https://www.anime-sama.fr/']) expect(hostAllowed(u, wild)).toBe(true)
    for (const u of ['https://anime-sama.evil.com/', 'https://notanime-sama.to/', 'http://anime-sama.to/', 'https://anime-sama/']) expect(hostAllowed(u, wild)).toBe(false)
  })
})
