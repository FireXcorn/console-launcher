import { existsSync, mkdtempSync, statSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { extractIcons } from './appicon'

describe('icône d’une application', () => {
  it('enregistre l’icône d’un programme en PNG, et ignore une cible introuvable', async () => {
    if (process.platform !== 'win32') return
    const dir = mkdtempSync(join(tmpdir(), 'ico-'))
    const ok = join(dir, 'ok.png')
    const ko = join(dir, 'ko.png')
    await extractIcons([
      { target: join(process.env.SystemRoot ?? 'C:/Windows', 'explorer.exe'), file: ok },
      { target: 'C:/introuvable/rien.exe', file: ko }
    ])
    expect(statSync(ok).size).toBeGreaterThan(500)
    expect(existsSync(ko)).toBe(false)
    if (process.env.CL_KEEP_ICON) console.log('ICON', ok)
  }, 40000)
})
