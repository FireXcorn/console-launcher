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
})
