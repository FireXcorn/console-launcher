import { describe, expect, it } from 'vitest'
import { NO_MEDIA, parseMpris, parseWindowsMedia, pickMprisPlayer } from './media'

describe('mini lecteur', () => {
  it('lit la réponse de Windows', () => {
    expect(parseWindowsMedia('{"available":true,"playing":true,"title":"Titre","artist":"Artiste"}\r\n')).toEqual({
      available: true,
      playing: true,
      title: 'Titre',
      artist: 'Artiste'
    })
    expect(parseWindowsMedia('{"available":false}')).toEqual(NO_MEDIA)
    expect(parseWindowsMedia('pas du json')).toEqual(NO_MEDIA)
  })

  it('lit un lecteur MPRIS (Linux)', () => {
    expect(pickMprisPlayer("(['org.freedesktop.DBus', 'org.mpris.MediaPlayer2.spotify', ':1.5'],)")).toBe('org.mpris.MediaPlayer2.spotify')
    expect(pickMprisPlayer("(['org.freedesktop.DBus'],)")).toBeNull()
    const meta = "(<{'mpris:length': <int64 1>, 'xesam:artist': <['Daft Punk']>, 'xesam:title': <'One More Time'>}>,)"
    expect(parseMpris("(<'Playing'>,)", meta)).toEqual({ available: true, playing: true, title: 'One More Time', artist: 'Daft Punk' })
    expect(parseMpris("(<'Paused'>,)", '(<{}>,)')).toEqual({ available: true, playing: false, title: '', artist: '' })
  })
})
