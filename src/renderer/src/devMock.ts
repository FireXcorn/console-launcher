import type { Theme } from '../../shared/theme'
import type { AlbumItem, Api, BackupInfo, Config, Game, NewsItem, RecipeInfo } from '../../shared/types'

/** Fausse API pour travailler l'interface dans un simple navigateur (développement uniquement). */
export function installDevMock(): void {
  let config: Config = {
    gamesDir: 'C:\\Jeux',
    launchExe: 'jeu.exe',
    launchArgs: ['--play'],
    appTitle: 'Console Launcher',
    appIcon: '',
    theme: 'light',
    activeTheme: 'clair',
    fullscreen: false,
    autoStart: false,
    // Aperçu : `?welcome` montre l'assistant du premier lancement (aucun jeu, assistant jamais vu).
    onboarded: !new URLSearchParams(location.search).has('welcome'),
    // Aperçu : `?plain` montre le mode « Sans thème ».
    gameBackdrop: !new URLSearchParams(location.search).has('plain'),
    backdropsDir: 'C:\\Images\\Fonds de jeux',
    swapConfirm: false,
    albumDir: 'C:\\Images\\Captures',
    captureKey: 'F12',
    newsFeedUrl: 'https://exemple.org/feed',
    charactersDir: 'C:\\Images\\Personnages',
    profiles: [
      { id: 'p1', name: 'Joueur', color: '#2f6fe0', background: 'g:ocean', avatar: '', image: '' },
      { id: 'p2', name: 'Invité', color: '#d6478f', background: 'p:pois', avatar: '', image: '' }
    ],
    activeProfile: 'p1',
    emulated: [
      { title: 'Super Aventure', emulatorExe: 'C:\\Outils\\mon-emulateur.exe', gameFile: 'D:\\Jeux\\super-aventure.xyz', args: ['-f', '-g', '{game}'], readyTitle: '' }
    ],
    recipeInputs: {},
    showAdvanced: new URLSearchParams(location.search).has('advanced'),
    showMissingGames: true,
    coversDir: 'C:\\Images\\Jaquettes',
    audioDir: 'C:\\Musique\\Console Launcher',
    sfxVolume: 70,
    musicVolume: 40,
    muted: false,
    playtime: { 'c:\\jeux\\0': 5400, 'c:\\jeux\\1': 860 },
    overrides: {},
    lastPlayed: {}
  }
  let userThemes: Theme[] = []
  const noGames = new URLSearchParams(location.search).has('welcome')
  const titles = noGames ? [] : ['Aventure des Cimes', 'Circuit Turbo', 'Royaume Perdu', 'Puzzle Lab', 'Étoiles', 'Kart Fiesta', 'Donjon 64']
  const games: Game[] = titles.map((title, i) => ({
    id: `c:\\jeux\\${i}`,
    title,
    dir: `C:\\Jeux\\${i}`,
    exe: 'jeu.exe',
    args: [],
    icon: null,
    lastPlayed: i === 0 ? Date.now() - 3600_000 : 0,
    available: true
  }))
  // Quelques exclusivités « cartouche non insérée », comme le fait le vrai scan.
  const missing = noGames ? [] : ['Mario Kart World', 'Donkey Kong Bananza', 'Kirby Air Riders', 'Splatoon Raiders', 'The Duskbloods']
  missing.forEach((title) =>
    games.push({
      id: `catalog:${title.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      title,
      dir: '',
      exe: '',
      args: [],
      icon: null,
      lastPlayed: 0,
      available: false
    })
  )

  const svg = (i: number, w: number, h: number): string => {
    const hue = (i * 47) % 360
    const markup =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs>` +
      `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 65% 55%)"/>` +
      `<stop offset="1" stop-color="hsl(${(hue + 60) % 360} 70% 35%)"/></linearGradient></defs>` +
      `<rect width="100%" height="100%" fill="url(#g)"/><text x="50%" y="52%" fill="white" font-size="${h / 4}" ` +
      `font-family="sans-serif" text-anchor="middle">${i + 1}</text></svg>`
    return `data:image/svg+xml;utf8,${encodeURIComponent(markup)}`
  }
  const album: AlbumItem[] = Array.from({ length: 11 }, (_, i) => ({
    path: `C:\\Images\\Captures\\Capture ${i + 1}.png`,
    name: `Capture ${i + 1}.png`,
    modified: Date.now() - i * 86_400_000
  }))
  const news: NewsItem[] = Array.from({ length: 8 }, (_, i) => ({
    title: `Actualité ${i + 1} : une très longue annonce qui occupe plusieurs lignes de la liste`,
    summary:
      'Un résumé de l’article en texte brut. Il explique en quelques phrases de quoi il s’agit, avec assez de contenu pour vérifier le retour à la ligne et la mise en page du panneau de détail.',
    link: `https://exemple.org/article-${i + 1}`,
    date: Date.now() - i * 43_200_000
  }))

  // Aperçu des jeux « à préparer » : un prêt, un qui attend son fichier, un qui attend sa préparation, un sans outil.
  const mockRecipes: RecipeInfo[] = [
    { id: 'a', title: 'Mario Kart World', state: 'needs-input', hasSetup: false, cli: false, note: '', inputs: {}, needs: [{ id: 'game', label: 'Fichier du jeu (.nup)', kind: 'file' }] },
    { id: 'b', title: 'Pokémon Pokopia', state: 'needs-setup', hasSetup: true, cli: false, note: 'Choisis ton dossier de dump dans la fenêtre qui s’ouvre.', inputs: {}, needs: [] },
    { id: 'c', title: 'Zelda Ocarina of Time', state: 'ready', hasSetup: true, cli: false, note: '', inputs: {}, needs: [] },
    { id: 'd', title: 'Donkey Kong Bananza', state: 'no-tool', hasSetup: false, cli: false, note: '', inputs: {}, needs: [] }
  ]

  const mockBackups: BackupInfo[] = [
    { name: 'joueurs-a.json', createdAt: Date.now() - 3_600_000, reason: 'manuelle', profiles: ['Joueur', 'Invité'] },
    { name: 'joueurs-b.json', createdAt: Date.now() - 90_000_000, reason: 'automatique', profiles: ['Joueur', 'Invité'] }
  ]

  const api: Api = {
    getConfig: async () => config,
    setConfig: async (patch) => (config = { ...config, ...patch }),
    scan: async () => games,
    launch: async (id) => console.info('[mock] lancement', id),
    onGameState: () => () => {},
    pickFolder: async () => null,
    pickImage: async () => null,
    pickFile: async () => null,
    toggleFullscreen: async () => {},
    log: async (message) => console.info('[mock] journal', message),
    quit: async () => console.info('[mock] quitter'),

    listAlbum: async () => (new URLSearchParams(location.search).has('empty') ? [] : album),
    albumThumb: async (path) => svg(Number(/(\d+)\.png$/.exec(path)?.[1] ?? 1), 480, 270),
    albumImage: async (path) => svg(Number(/(\d+)\.png$/.exec(path)?.[1] ?? 1), 1280, 720),
    deleteAlbumItem: async (path) => {
      console.info('[mock] corbeille', path)
      const i = album.findIndex((a) => a.path === path)
      if (i >= 0) album.splice(i, 1)
      return true
    },
    openAlbumFolder: async () => console.info('[mock] dossier de l’album'),
    fetchNews: async () => ({ items: news, fetchedAt: Date.now(), stale: false }),
    openExternal: async (url) => {
      console.info('[mock] ouvrir', url)
      return true
    },
    networkInfo: async () => ({ ssid: 'MaBox 5G', signal: 72 }),
    // Aperçu : ?backdrops=<url> sert 0.jpg, 1.jpg, 2.jpg aux trois premiers jeux ; sans lui, aucun jeu n'a de grande image.
    gameBackdrop: async (id) => {
      const base = new URLSearchParams(location.search).get('backdrops')
      const n = games.findIndex((g) => g.id === id)
      if (!base || n < 0 || n > 2) return null
      // Comme le vrai lanceur : une URL data: (la politique de sécurité n'accepte pas d'image distante).
      const blob = await (await fetch(`${base}${n}.jpg`)).blob()
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.readAsDataURL(blob)
      })
    },
    findPrograms: async () => [
      { title: 'Super Aventure', exe: 'D:\\Jeux\\Super Aventure\\jeu.exe' },
      { title: 'Circuit Turbo', exe: 'D:\\Jeux\\Circuit Turbo\\turbo.exe' },
      { title: 'Puzzle Lab', exe: 'D:\\Jeux\\Puzzle Lab\\lab.exe' }
    ],
    stopGame: async () => console.info('[mock] arrêt du jeu'),
    listRecipes: async () => mockRecipes,
    setRecipeInput: async () => mockRecipes,
    listBackups: async () => mockBackups,
    createBackup: async () => mockBackups,
    restoreBackup: async () => true,
    exportBackup: async () => null,
    importBackup: async () => false,
    openBackupFolder: async () => undefined,
    runRecipeSetup: async () => true,
    cancelRecipeSetup: async () => true,
    power: async (action) => console.info('[mock] alimentation', action),
    profileImages: async () => ({}),
    // Faux personnages de l'utilisateur : des pastilles que je génère, aucune image réelle.
    listCharacters: async () =>
      new URLSearchParams(location.search).has('nochars')
        ? []
        : [
            {
              name: 'Aventuriers',
              items: ['Archer', 'Chevalier', 'Mage'].map((name, i) => ({
                id: `file:Aventuriers/${name}.png`,
                name,
                thumb: svg(i + 3, 160, 160)
              }))
            },
            { name: '', items: [{ id: 'file:solo.png', name: 'Solo', thumb: svg(9, 160, 160) }] }
          ],
    previewImage: async () => svg(5, 256, 256),
    customAudio: async () => null,
    listThemes: async () => userThemes,
    themeWallpaper: async () => svg(4, 1280, 720),
    previewWallpaper: async () => svg(7, 1280, 720),
    saveTheme: async (theme) => {
      const id = theme.id || `perso-${userThemes.length + 1}`
      const saved = { ...theme, id }
      userThemes = [...userThemes.filter((t) => t.id !== id), saved]
      return saved
    },
    importTheme: async () => null,
    deleteTheme: async (id) => {
      userThemes = userThemes.filter((t) => t.id !== id)
      return true
    },
    openThemesFolder: async () => console.info('[mock] dossier des thèmes')
  }
  window.api = api
}
