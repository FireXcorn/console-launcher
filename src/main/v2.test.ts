import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { captureFileName, insideDir, listImageFiles } from './album'
import { ConfigStore } from './config'
import { parseFeed, safeHttpsUrl, toPlainText } from './news'
import { isAllowedExternal, parseSsid, powerCommand } from './system'

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'v2-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('flux d’actualités', () => {
  const rss = `<?xml version="1.0"?><rss><channel>
    <item><title><![CDATA[Zelda &amp; amis]]></title><link>https://exemple.org/a</link>
      <description>&lt;p&gt;Un &lt;b&gt;texte&lt;/b&gt; &amp;amp; plus&lt;/p&gt;</description>
      <pubDate>Mon, 02 Nov 2026 10:00:00 GMT</pubDate></item>
    <item><title>Plus récent</title><link>https://exemple.org/b</link><pubDate>Tue, 10 Nov 2026 10:00:00 GMT</pubDate></item>
    <item><title>Lien dangereux</title><link>javascript:alert(1)</link></item>
    <item><title>Lien http</title><link>http://exemple.org/c</link></item>
    <item><link>https://exemple.org/sans-titre</link></item>
  </channel></rss>`

  it('lit un RSS, trie par date et écarte les liens non https', () => {
    const items = parseFeed(rss)
    expect(items.map((i) => i.title)).toEqual(['Plus récent', 'Zelda & amis'])
    expect(items[1].summary).toBe('Un texte & plus')
    expect(items[1].link).toBe('https://exemple.org/a')
  })

  it('lit un Atom', () => {
    const atom = `<feed><entry><title>Billet</title><link href="https://exemple.org/atom" rel="alternate"/>
      <summary>Résumé</summary><updated>2026-11-01T08:00:00Z</updated></entry></feed>`
    expect(parseFeed(atom)).toEqual([
      { title: 'Billet', summary: 'Résumé', link: 'https://exemple.org/atom', date: Date.parse('2026-11-01T08:00:00Z') }
    ])
  })

  it('ne renvoie jamais de balises et gère un flux vide ou invalide', () => {
    expect(toPlainText('<script>x()</script>&lt;img src=x&gt;Salut')).not.toMatch(/[<>]/)
    expect(parseFeed('')).toEqual([])
    expect(parseFeed('<html>pas un flux</html>')).toEqual([])
  })

  it('tronque les longs résumés', () => {
    const long = `<rss><item><title>T</title><link>https://e.org/x</link><description>${'a'.repeat(500)}</description></item></rss>`
    expect(parseFeed(long)[0].summary).toHaveLength(298)
  })

  it('valide les adresses https', () => {
    expect(safeHttpsUrl('https://a.org/x')).toBe('https://a.org/x')
    expect(safeHttpsUrl('http://a.org')).toBeNull()
    expect(safeHttpsUrl('file:///c:/x')).toBeNull()
    expect(safeHttpsUrl('nimporte quoi')).toBeNull()
  })
})

describe('album', () => {
  it('liste les images, la plus récente d’abord, sans les autres fichiers', async () => {
    const dir = join(root, 'album')
    mkdirSync(dir)
    writeFileSync(join(dir, 'vieille.png'), '')
    writeFileSync(join(dir, 'neuve.JPG'), '')
    writeFileSync(join(dir, 'notes.txt'), '')
    utimesSync(join(dir, 'vieille.png'), new Date(2026, 0, 1), new Date(2026, 0, 1))
    utimesSync(join(dir, 'neuve.JPG'), new Date(2026, 5, 1), new Date(2026, 5, 1))
    expect((await listImageFiles(dir)).map((i) => i.name)).toEqual(['neuve.JPG', 'vieille.png'])
  })

  it('renvoie une liste vide si le dossier est absent', async () => {
    expect(await listImageFiles(join(root, 'absent'))).toEqual([])
    expect(await listImageFiles('')).toEqual([])
  })

  it('refuse les chemins hors du dossier', () => {
    const dir = join(root, 'album')
    expect(insideDir(dir, join(dir, 'a.png'))).toBe(true)
    expect(insideDir(dir, join(dir, '..', 'secret.png'))).toBe(false)
    expect(insideDir(dir, dir)).toBe(false)
    expect(insideDir('', join(dir, 'a.png'))).toBe(false)
  })

  it('nomme les captures avec la date', () => {
    expect(captureFileName(new Date(2026, 10, 12, 9, 5, 7))).toBe('Capture 2026-11-12 09-05-07.png')
  })
})

describe('système', () => {
  it('construit les commandes d’alimentation', () => {
    expect(powerCommand('shutdown')).toEqual({ file: 'shutdown.exe', args: ['/s', '/t', '0'] })
    expect(powerCommand('restart')?.args).toEqual(['/r', '/t', '0'])
    expect(powerCommand('sleep')?.file).toBe('rundll32.exe')
    expect(powerCommand('nimporte' as never)).toBeNull()
  })

  it('lit le nom du réseau et ignore le BSSID', () => {
    const out = '    Nom                    : Wi-Fi\n    SSID                   : MaBox 5G\n    BSSID                  : aa:bb:cc\n'
    expect(parseSsid(out)).toBe('MaBox 5G')
    expect(parseSsid('Aucune interface')).toBeNull()
  })

  it('n’ouvre que https et des réglages connus', () => {
    expect(isAllowedExternal('https://exemple.org')).toBe(true)
    expect(isAllowedExternal('ms-settings:powersleep')).toBe(true)
    expect(isAllowedExternal('ms-settings:privacy')).toBe(false)
    expect(isAllowedExternal('http://exemple.org')).toBe(false)
    expect(isAllowedExternal('file:///c:/windows/system32/cmd.exe')).toBe(false)
    expect(isAllowedExternal('cmd.exe')).toBe(false)
  })
})

describe('configuration', () => {
  it('complète une ancienne configuration avec les nouvelles valeurs', () => {
    const file = join(root, 'config.json')
    writeFileSync(file, JSON.stringify({ gamesDir: 'X', profile: { name: 'Ismaël' } }))
    const cfg = new ConfigStore(file).get()
    expect(cfg.gamesDir).toBe('X')
    // L'ancien profil unique devient le premier profil de la liste.
    expect(cfg.profiles).toEqual([
      { id: 'p1', name: 'Ismaël', color: '#2f6fe0', background: 'c:#2f6fe0', avatar: '', image: '' }
    ])
    expect(cfg.activeProfile).toBe('p1')
    expect('profile' in cfg).toBe(false)
    expect(cfg.captureKey).toBe('F12')
    expect(cfg.playtime).toEqual({})
    // Le fond animé du jeu sélectionné est actif par défaut, y compris pour une ancienne configuration.
    expect(cfg.gameBackdrop).toBe(true)
  })
})
