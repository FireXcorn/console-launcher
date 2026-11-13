import { describe, expect, it } from 'vitest'
import { desktopEntry, parseSignal } from './system'

describe('Wi-Fi et démarrage automatique', () => {
  it('lit la qualité du signal de netsh', () => {
    expect(parseSignal('    SSID                   : Box\n    Signal                 : 87%\n')).toBe(87)
    expect(parseSignal('    Signal : 100 %')).toBe(100)
    expect(parseSignal('pas de wifi')).toBeNull()
  })

  it('écrit un lanceur Linux sûr', () => {
    const text = desktopEntry('/opt/Console Launcher/app', 'Ma console\nExec=evil')
    expect(text).toContain('Exec="/opt/Console Launcher/app"')
    expect(text.match(/^Exec=/gm)).toHaveLength(1)
    expect(text).toContain('Name=Ma console Exec=evil')
  })
})
