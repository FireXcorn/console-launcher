import { mkdirSync, mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { gameBase, loadRecipes, recipeEntries, recipeInfo, setupArgs, type Recipe, type RecipePaths } from './recipes'

const paths: RecipePaths = { toolsDir: 'T', outRoot: 'O' }
const norm = (p: string): string => p.split('\\').join('/')
const present =
  (...list: string[]) =>
  (p: string): boolean =>
    list.includes(norm(p))

/** Outil dont l'utilisateur donne un fichier, avec une préparation qui écrit dans le dossier du jeu. */
const cli: Recipe = {
  id: 'jeu',
  title: 'Jeu',
  tool: 'outil',
  base: 'out',
  exe: 'jeu.exe',
  needs: [{ id: 'nup', label: 'Fichier', kind: 'file' }],
  setup: { mode: 'cli', exe: 'python/python.exe', args: ['--nup', '{nup}', '--dest', '{out}'] },
  doneFile: 'jeu.exe'
}

/** Outil à fenêtre : l'utilisateur indique ensuite le dossier construit. */
const gui: Recipe = {
  id: 'zel',
  title: 'Zel',
  tool: 'bld',
  base: 'need:out',
  exe: 'bin/z.exe',
  needs: [{ id: 'out', label: 'Dossier', kind: 'folder' }],
  setup: { exe: 'Builder.exe' },
  doneFile: 'bin/z.exe'
}

describe('recettes', () => {
  it('outil lancé par le lanceur : absent → fichier manquant → à préparer → prêt', () => {
    const tool = 'T/outil/python/python.exe'
    expect(recipeInfo(cli, paths, {}, present()).state).toBe('no-tool')
    expect(recipeInfo(cli, paths, {}, present(tool)).state).toBe('needs-input')
    const inputs = { jeu: { nup: 'D:/jeu.nup' } }
    expect(recipeInfo(cli, paths, inputs, present(tool, 'D:/jeu.nup')).state).toBe('needs-setup')
    expect(recipeInfo(cli, paths, inputs, present(tool, 'D:/jeu.nup', 'O/jeu/jeu.exe')).state).toBe('ready')
  })

  it('outil à fenêtre : prêt quand le dossier indiqué contient le jeu', () => {
    const tool = 'T/bld/Builder.exe'
    expect(recipeInfo(gui, paths, {}, present(tool)).state).toBe('needs-setup')
    expect(recipeInfo(gui, paths, { zel: { out: 'G/Z' } }, present(tool)).state).toBe('needs-setup')
    expect(recipeInfo(gui, paths, { zel: { out: 'G/Z' } }, present(tool, 'G/Z/bin/z.exe')).state).toBe('ready')
  })

  it('remplace {entrée} et {out} dans la commande de préparation', () => {
    const args = setupArgs(cli, paths, { jeu: { nup: 'D:/jeu.nup' } }).map(norm)
    expect(args).toEqual(['--nup', 'D:/jeu.nup', '--dest', 'O/jeu'])
    expect(norm(gameBase(cli, paths, {}) ?? '')).toBe('O/jeu')
    expect(gameBase(gui, paths, {})).toBeNull()
  })

  it('ne produit une entrée de jeu que pour une recette prête', () => {
    const tool = 'T/outil/python/python.exe'
    const inputs = { jeu: { nup: 'D:/jeu.nup' } }
    expect(recipeEntries([cli], paths, inputs, present(tool, 'D:/jeu.nup'))).toEqual([])
    const [entry] = recipeEntries([cli], paths, inputs, present(tool, 'D:/jeu.nup', 'O/jeu/jeu.exe'))
    expect(entry.title).toBe('Jeu')
    expect(norm(entry.emulatorExe)).toBe('O/jeu/jeu.exe')
  })

  it('lit un dossier de recettes en ignorant les fichiers invalides', () => {
    const dir = mkdtempSync(join(tmpdir(), 'recettes-'))
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'a.json'), '\uFEFF' + JSON.stringify({ id: 'a', title: 'A', tool: 't', exe: 'a.exe' }))
    writeFileSync(join(dir, 'b.json'), '{ pas du json')
    writeFileSync(join(dir, 'c.json'), JSON.stringify({ id: 'c' }))
    expect(loadRecipes(dir).map((r) => r.id)).toEqual(['a'])
  })

  it('les recettes livrées sont valides', () => {
    const ids = loadRecipes(join(__dirname, '../../recipes')).map((r) => r.id)
    expect(ids).toEqual(['donkey-kong-bananza', 'mario-kart-world', 'pokopia', 'zelda-ocarina-of-time'])
  })
})

describe('describeLine', () => {
  it('résume les évènements JSON et laisse le texte tel quel', async () => {
    const { describeLine } = await import('./recipes')
    expect(describeLine('Bonjour')).toBe('Bonjour')
    expect(describeLine('{"type":"progress","step":"lift","phase":"x","done":50,"total":200}')).toBe('lift — x 25 %')
    expect(describeLine('{"type":"end","result":"ok"}')).toBe('Terminé')
    expect(describeLine('{"type":"step","step":"compile","state":"started"}')).toBe('Étape compile : en cours')
  })
})
