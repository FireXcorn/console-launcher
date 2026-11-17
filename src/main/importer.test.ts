import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { findPrograms, parseGames } from './importer'

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'imp-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

const put = (path: string, size = 10): void => {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, 'x'.repeat(size))
}

describe('import d’un dossier de jeux', () => {
  it('trouve un programme par sous-dossier, avec le titre du dossier nettoyé', async () => {
    put(join(root, 'Super Aventure [v1.2]', 'jeu.exe'))
    put(join(root, 'Circuit Turbo', 'bin', 'turbo.exe'))
    const found = await findPrograms(root)
    expect(found.map((f) => f.title)).toEqual(['Circuit Turbo', 'Super Aventure'])
    expect(found[0].exe).toBe(join(root, 'Circuit Turbo', 'bin', 'turbo.exe'))
  })

  it('écarte désinstalleurs, installeurs et rapporteurs d’erreurs', async () => {
    put(join(root, 'Puzzle Lab', 'unins000.exe'), 5000)
    put(join(root, 'Puzzle Lab', 'vc_redist.x64.exe'), 9000)
    put(join(root, 'Puzzle Lab', 'CrashReportClient.exe'), 8000)
    put(join(root, 'Puzzle Lab', 'lab.exe'), 100)
    expect((await findPrograms(root))[0].exe).toBe(join(root, 'Puzzle Lab', 'lab.exe'))
  })

  it('préfère le programme dont le nom ressemble au dossier, sinon le plus gros', async () => {
    put(join(root, 'Royaume Perdu', 'outil.exe'), 9000)
    put(join(root, 'Royaume Perdu', 'royaume.exe'), 100)
    put(join(root, 'Autre Jeu', 'a.exe'), 10)
    put(join(root, 'Autre Jeu', 'b.exe'), 500)
    const found = await findPrograms(root)
    expect(found.find((f) => f.title === 'Royaume Perdu')?.exe).toBe(join(root, 'Royaume Perdu', 'royaume.exe'))
    expect(found.find((f) => f.title === 'Autre Jeu')?.exe).toBe(join(root, 'Autre Jeu', 'b.exe'))
  })

  it('ignore les dossiers sans programme et un dossier inexistant', async () => {
    mkdirSync(join(root, 'Vide'))
    writeFileSync(join(root, 'notes.txt'), 'x')
    expect(await findPrograms(root)).toEqual([])
    expect(await findPrograms(join(root, 'absent'))).toEqual([])
    expect(await findPrograms('')).toEqual([])
  })
})

describe('jeux installés (Store, Steam, Epic)', () => {
  it('garde les jeux, écarte les composants Steam, et prépare le lancement par l’explorateur', () => {
    const store = 'shell:AppsFolder\\436609B6!AppFortniteShipping'
    const json = JSON.stringify([
      { Name: 'Fortnite', Open: store, Icon: store },
      { Name: 'Hades', Open: 'steam://rungameid/1145360', Icon: null },
      { Name: 'Steamworks Common Redistributables', Open: 'steam://rungameid/228980', Icon: null },
      { Name: 'Proton 9.0', Open: 'steam://rungameid/2805730', Icon: null },
      { Name: 'Rocket League', Open: 'com.epicgames.launcher://apps/Sugar?action=launch&silent=true', Icon: 'C:/Jeux/RL.exe' },
      { Name: 'Hades', Open: 'steam://rungameid/1145360', Icon: null }
    ])
    expect(parseGames(json, 'explorer.exe')).toEqual([
      { title: 'Fortnite', exe: 'explorer.exe', args: [store], icon: store },
      { title: 'Hades', exe: 'explorer.exe', args: ['steam://rungameid/1145360'] },
      { title: 'Rocket League', exe: 'explorer.exe', args: ['com.epicgames.launcher://apps/Sugar?action=launch&silent=true'], icon: 'C:/Jeux/RL.exe' }
    ])
  })

  it('lance un programme GOG directement, et garde l’icône Steam', () => {
    const json = JSON.stringify([
      { Name: 'Witcher', Open: 'D:/GOG/witcher.exe', Icon: 'D:/GOG/witcher.exe' },
      { Name: 'Hades', Open: 'steam://rungameid/1145360', Icon: 'C:/Steam/appcache/librarycache/1145360/library_600x900.jpg' }
    ])
    expect(parseGames(json, 'explorer.exe')).toEqual([
      { title: 'Hades', exe: 'explorer.exe', args: ['steam://rungameid/1145360'], icon: 'C:/Steam/appcache/librarycache/1145360/library_600x900.jpg' },
      { title: 'Witcher', exe: 'D:/GOG/witcher.exe', icon: 'D:/GOG/witcher.exe' }
    ])
  })

  it('accepte un seul jeu et refuse une sortie illisible', () => {
    expect(parseGames('{"Name":"Jeu","Open":"steam://rungameid/1"}', 'e')).toHaveLength(1)
    expect(parseGames('pas du json', 'e')).toEqual([])
  })
})
