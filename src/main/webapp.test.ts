import { describe, expect, it } from 'vitest'
import { glassBackButton, hostAllowed, isCloseShortcut } from './webapp'

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

describe('raccourci de retour au lanceur', () => {
  it('F4 et Maj + F4 ferment le site, pas les autres touches ni Ctrl/Alt + F4', () => {
    expect(isCloseShortcut({ key: 'F4' })).toBe(true)
    expect(isCloseShortcut({ key: 'F4', shift: true } as never)).toBe(true)
    expect(isCloseShortcut({ key: 'Shift' })).toBe(false)
    expect(isCloseShortcut({ key: 'F3' })).toBe(false)
    expect(isCloseShortcut({ key: 'F4', alt: true })).toBe(false)
    expect(isCloseShortcut({ key: 'F4', control: true })).toBe(false)
  })
})

describe('bouton Retour en verre liquide', () => {
  it('est un script valide, avec flou et lu{2019}action demandée', () => {
    const js = glassBackButton("send('close')")
    expect(() => new Function(js)).not.toThrow()
    expect(js).toContain('backdrop-filter:blur')
    expect(js).toContain("send('close')")
  })
})
