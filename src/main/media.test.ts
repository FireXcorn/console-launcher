import { describe, expect, it } from 'vitest'
import { NO_MEDIA, parseMpris, parseWindowsMedia, pickMprisPlayer } from './media'

describe('mini lecteur', () => {
  it('lit la réponse de Windows', () => {
    expect(parseWindowsMedia('{"available":true,"playing":true,"title":"Titre","artist":"Artiste","art":"data:image/png;base64,AAA","position":20,"duration":111}\r\n')).toEqual({
      available: true,
      playing: true,
      title: 'Titre',
      artist: 'Artiste',
      art: 'data:image/png;base64,AAA',
      position: 20,
      duration: 111
    })
    expect(parseWindowsMedia('{"available":true,"app":"applemusic"}').app).toBe('applemusic')
    expect(parseWindowsMedia('{"available":true,"app":"spotify"}').app).toBe('spotify')
    expect(parseWindowsMedia('{"available":true,"app":"autre"}').app).toBeUndefined()
    expect(parseMpris("(<'Playing'>,)", '').app).toBe('spotify')
    expect(parseWindowsMedia('{"available":false}')).toEqual(NO_MEDIA)
    expect(parseWindowsMedia('pas du json')).toEqual(NO_MEDIA)
  })

  it('lit un lecteur MPRIS (Linux)', () => {
    expect(pickMprisPlayer("(['org.freedesktop.DBus', 'org.mpris.MediaPlayer2.spotify', ':1.5'],)")).toBe('org.mpris.MediaPlayer2.spotify')
    expect(pickMprisPlayer("(['org.freedesktop.DBus'],)")).toBeNull()
    expect(pickMprisPlayer("(['org.mpris.MediaPlayer2.firefox.instance1'],)")).toBeNull()
    const meta = "(<{'mpris:length': <int64 1>, 'xesam:artist': <['Daft Punk']>, 'xesam:title': <'One More Time'>}>,)"
    expect(parseMpris("(<'Playing'>,)", meta, '(<int64 20000000>,)')).toMatchObject({ playing: true, title: 'One More Time', artist: 'Daft Punk', position: 20 })
    expect(parseMpris("(<'Playing'>,)", "(<{'mpris:length': <int64 111000000>}>,)")).toMatchObject({ duration: 111 })
    expect(parseMpris("(<'Paused'>,)", '(<{}>,)')).toMatchObject({ available: true, playing: false, title: '', artist: '' })
  })
})
