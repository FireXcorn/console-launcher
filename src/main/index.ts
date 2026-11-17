import {
  app,
  BrowserWindow,
  desktopCapturer,
  dialog,
  globalShortcut,
  ipcMain,
  nativeImage,
  net,
  Notification,
  screen,
  session as electronSession,
  shell
} from 'electron'
import { execFile, spawn } from 'child_process'
import { APPS, appInfo, appsRoot, installApp, launchPath, removeApp, startDetached } from './apps'
import { HomeView } from './homeview'
import { extractIcons } from './appicon'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { mkdir, writeFile } from 'fs/promises'
import { basename, dirname, extname, join } from 'path'
import { playtimeKey } from '../shared/playtime'
import { applyAutoStart } from './autostart'
import type { ChildProcess } from 'child_process'
import { listCharacterFiles, resolveCharacterFile } from './characters'
import type {
  AlbumItem,
  CharacterSeries,
  ProfileArt,
  Config,
  Game,
  GameState,
  NetworkInfo,
  NewsItem,
  NewsResult,
  PowerAction,
  RecipeInfo
} from '../shared/types'
import { captureFileName, insideDir, isImageFile, listImageFiles } from './album'
import { findAudioFile, isAudioName } from './audio'
import { EMULATORS } from '../shared/emulators'
import { findBackdrop, findCover, missingEntries, normalizeTitle, pokemonConsole, pokemonEntries, pokemonRank } from './catalog'
import { findPrograms, installedGames } from './importer'
import { ConfigStore } from './config'
import { Launcher } from './launcher'
import { addRoms, ensureRomFolder, ROM_EXTENSIONS, romEntries } from './romfolder'
import { emulatedId, scanLibrary, type ScannedGame } from './library'
import { autoBackup, listBackups, parseBackup, restorePatch, takeSnapshot, writeBackup, pruneBackups } from './backup'
import { GameSaves, resolveSaveDirs, saveRulesFor } from './saves'
import { describeLine, loadRecipes, recipeEntries, recipeInfo, runSetup, type RecipePaths } from './recipes'
import { initLog, log } from './log'
import { parseFeed, safeHttpsUrl } from './news'
import { isAllowedExternal, parseSignal, parseSsid, powerCommand } from './system'
import { isBuiltinTheme, normalizeTheme, safeWallpaperName, type Theme } from '../shared/theme'
import {
  MAX_WALLPAPER_BYTES,
  importTheme,
  listThemes,
  saveTheme,
  soundsFolder,
  themeFolder,
  wallpaperPath
} from './themes'

const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon'
}
const DEFAULT_TITLE = 'Console Launcher'
const MAX_IMAGE_BYTES = 12 * 1024 * 1024
const MAX_BACKDROP_BYTES = 8 * 1024 * 1024

let win: BrowserWindow | null = null
let store: ConfigStore
let games: ScannedGame[] = []

/** Jeu en cours : sert au temps de jeu. */
let session: { id: string; start: number; saves?: { profile: string; key: string; dirs: string[] } } | null = null
let captureKeyRegistered: string | null = null

/** Sauvegardes de jeu rangées par profil (voir saves.ts). */
const savesStore = (): GameSaves => new GameSaves(join(app.getPath('userData'), 'saves'))

/** Dossiers de sauvegarde d'un jeu d'après les recettes (par son titre), ou null si on n'en connaît pas. */
function saveSetupFor(game: ScannedGame): { key: string; dirs: string[] } | null {
  const rules = saveRulesFor([game.title, game.sourceTitle ?? ''], loadRecipes(bundledDir('recipes')))
  if (rules.length === 0) return null
  const env = { appdata: app.getPath('appData'), localappdata: process.env.LOCALAPPDATA ?? '', userprofile: app.getPath('home') }
  return { key: game.id, dirs: resolveSaveDirs(rules, game.dir, env) }
}

/** Ajoute le temps joué au compteur de l'utilisateur actif. */
function addPlaytime(id: string, seconds: number): void {
  const cfg = store.get()
  const key = playtimeKey(cfg.activeProfile, id)
  store.set({ playtime: { ...cfg.playtime, [key]: (cfg.playtime[key] ?? 0) + seconds } })
}

/** Enregistre une capture de l'écran principal dans l'album. */
async function takeCapture(): Promise<void> {
  const dir = store.get().albumDir
  if (!dir) return
  try {
    const display = screen.getPrimaryDisplay()
    const size = {
      width: Math.round(display.size.width * display.scaleFactor),
      height: Math.round(display.size.height * display.scaleFactor)
    }
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: size })
    const source = sources.find((s) => s.display_id === String(display.id)) ?? sources[0]
    if (!source || source.thumbnail.isEmpty()) {
      log('capture impossible : aucune image reçue')
      return
    }
    await mkdir(dir, { recursive: true })
    const file = join(dir, captureFileName(new Date()))
    await writeFile(file, source.thumbnail.toPNG())
    log('capture enregistrée', file)
    new Notification({ title: 'Capture enregistrée', body: basename(file), silent: true }).show()
  } catch (err) {
    log('capture en échec', String(err))
  }
}

function registerCapture(): void {
  const key = store.get().captureKey.trim()
  if (!key) return
  try {
    if (globalShortcut.register(key, () => void takeCapture())) captureKeyRegistered = key
    else log('raccourci de capture indisponible (déjà utilisé ?)', key)
  } catch (err) {
    log('raccourci de capture invalide', key, String(err))
  }
}

function unregisterCapture(): void {
  if (!captureKeyRegistered) return
  globalShortcut.unregister(captureKeyRegistered)
  captureKeyRegistered = null
}

/** Pendant un jeu : Ctrl+Alt+Q l'arrête et ramène au menu (sur manette : Retour + Menu maintenus 2 s). */
const STOP_KEY = 'CommandOrControl+Alt+Q'
let stopKeyRegistered = false

function registerStop(): void {
  try {
    stopKeyRegistered = globalShortcut.register(STOP_KEY, () => launcher.stop())
  } catch (err) {
    log("raccourci d'arrêt invalide", String(err))
  }
}

function unregisterStop(): void {
  if (!stopKeyRegistered) return
  globalShortcut.unregister(STOP_KEY)
  stopKeyRegistered = false
}

/** Le lanceur se retire seul si le jeu ne se signale pas : plus court pour un jeu émulé, qui charge vite. */
const HIDE_FALLBACK_MS = 120_000
const HIDE_FALLBACK_EMULATED_MS = 45_000
let hideFallbackMs = HIDE_FALLBACK_MS
let hideTimer: ReturnType<typeof setTimeout> | undefined

function hideLauncher(): void {
  clearTimeout(hideTimer)
  if (win && launcher.isRunning) {
    log('le lanceur se retire : le jeu est affiché')
    win.setAlwaysOnTop(false)
    win.hide()
  }
}

/** Sauvegardes préparées pour le jeu qui démarre ; elles passent dans la session dès qu'il tourne. */
let pendingSaves: { profile: string; key: string; dirs: string[] } | null = null

const launcher: Launcher = new Launcher(
  (state: GameState) => {
    log('jeu', state)
    if (state.status === 'running') {
      session = { id: state.id, start: Date.now(), saves: pendingSaves ?? undefined }
      pendingSaves = null
      registerCapture()
      registerStop()
    } else {
      unregisterCapture()
      unregisterStop()
      if (session) {
        const seconds = Math.round((Date.now() - session.start) / 1000)
        if (seconds >= 5) addPlaytime(session.id, seconds)
        if (session.saves) {
          try {
            const done = savesStore().collect(session.saves.profile, session.saves.key, session.saves.dirs)
            log('sauvegardes du jeu rangées', { profil: session.saves.profile, jeu: session.id, ok: done })
          } catch (e) {
            log('sauvegardes du jeu : rangement impossible', String(e))
          }
        }
        session = null
      }
    }
    if (!win) return
    clearTimeout(hideTimer)
    if (state.status === 'running') {
      // On reste en plein écran noir tant que le jeu charge : le bureau ne doit pas apparaître derrière sa fenêtre.
      // Au-dessus de tout, pour qu'aucune fenêtre (jeu ou émulateur) ne s'affiche devant avant d'être prête.
      win.setFullScreen(true)
      win.setAlwaysOnTop(true, 'screen-saver')
      hideTimer = setTimeout(hideLauncher, hideFallbackMs)
    } else {
      win.setAlwaysOnTop(false)
      win.setFullScreen(store.get().fullscreen)
      win.show()
      win.focus()
    }
    win.webContents.send('game:state', state)
  },
  hideLauncher,
  (line) => log('suivi du jeu', line)
)

/**
 * Lit l'image et la renvoie sous forme d'URL `data:`. L'image voyage ainsi avec la liste des
 * jeux : aucun chargement séparé ne peut échouer côté interface.
 */
function imageDataUrl(file: string, maxBytes = MAX_IMAGE_BYTES): string | null {
  const mime = IMAGE_MIME[extname(file).toLowerCase()]
  if (!mime) {
    log('image ignorée (format non pris en charge)', file)
    return null
  }
  try {
    const size = statSync(file).size
    if (size > maxBytes) {
      log('image ignorée (trop lourde)', file, size)
      return null
    }
    return `data:${mime};base64,${readFileSync(file).toString('base64')}`
  } catch (err) {
    log('image illisible', file, String(err))
    return null
  }
}

/** Applique à la fenêtre du lanceur le titre et l'icône choisis dans les réglages. */
function applyBranding(): void {
  if (!win) return
  const cfg = store.get()
  win.setTitle(cfg.appTitle?.trim() || DEFAULT_TITLE)
  if (!cfg.appIcon) return
  if (!existsSync(cfg.appIcon)) {
    log('icône de fenêtre introuvable', cfg.appIcon)
    return
  }
  const image = nativeImage.createFromPath(cfg.appIcon)
  if (image.isEmpty()) log('icône de fenêtre illisible (png, jpg ou ico attendu)', cfg.appIcon)
  else win.setIcon(image)
}

/**
 * Fabrique un PNG carré à partir de l'image d'un jeu, pour servir d'icône à la fenêtre du jeu.
 * Le recadrage est fait par l'interface (canvas), qui sait décoder tous les formats acceptés.
 */
async function squareIconPng(file: string): Promise<string | null> {
  const src = imageDataUrl(file)
  if (!src || !win) return null
  try {
    const dataUrl: string = await win.webContents.executeJavaScript(`(async () => {
      const img = new Image()
      img.src = ${JSON.stringify(src)}
      await img.decode()
      const side = Math.min(img.naturalWidth, img.naturalHeight)
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 256
      canvas.getContext('2d').drawImage(
        img,
        (img.naturalWidth - side) / 2, (img.naturalHeight - side) * 0.12, side, side,
        0, 0, 256, 256
      )
      return canvas.toDataURL('image/png')
    })()`)
    const out = join(app.getPath('temp'), 'console-launcher-game-icon.png')
    writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'))
    return out
  } catch (err) {
    log('icône du jeu non générée', file, String(err))
    return null
  }
}

function toGame(g: ScannedGame): Game {
  // Les chemins de lancement ne regardent pas l'interface.
  const { iconPath, exePath: _exe, watch: _watch, ...rest } = g
  // Sans image propre au jeu, on cherche une jaquette déposée sous son titre dans le dossier des jaquettes.
  const image = iconPath ?? coverOf(g.title) ?? (existsSync(appIconFile(g)) ? appIconFile(g) : null)
  return { ...rest, icon: image ? imageDataUrl(image) : null, available: true }
}

/** Icône Windows d'un jeu PC, gardée dans les données du lanceur : elle sert de tuile quand le jeu n'a pas d'image. */
const appIconFile = (g: ScannedGame): string => join(app.getPath('userData'), 'app-icons', normalizeTitle(g.id) + '.png')
/** Jeux dont l'icône n'a pas pu être lue : on ne réessaie pas à chaque scan. */
const iconFailed = new Set<string>()

/** Jeux PC sans image (ni jaquette, ni image choisie) : on prend l'icône du programme, celle du bureau. */
async function fetchAppIcons(list: ScannedGame[]): Promise<void> {
  const todo = list.filter(
    // Un jeu sur émulateur a son fichier de jeu dans ses arguments : l'icône de l'émulateur ne le représenterait pas.
    // Un jeu lancé par l'explorateur (Steam, Epic) sans origine d'icône : celle de l'explorateur ne le représenterait pas.
    (g) => g.emulated && (g.iconFrom || (g.exePath && !/explorer\.exe$/i.test(g.exePath) || g.args.some((a) => a.startsWith('shell:AppsFolder\\'))) ) && !g.iconPath && !coverOf(g.title) && !g.args.some((a) => existsSync(a)) && !existsSync(appIconFile(g)) && !iconFailed.has(g.id)
  )
  if (todo.length === 0) return
  mkdirSync(join(app.getPath('userData'), 'app-icons'), { recursive: true })
  await extractIcons(todo.map((g) => ({ target: g.iconFrom ?? g.args.find((a) => a.startsWith('shell:AppsFolder\\')) ?? g.exePath!, file: appIconFile(g) })))
  for (const g of todo) if (!existsSync(appIconFile(g))) iconFailed.add(g.id)
}

/** Exclusivités Switch 2 absentes de la bibliothèque : affichées, jamais lançables. */
function missingGames(installed: Game[]): Game[] {
  const cfg = store.get()
  // Jeux livrés avec leur outil mais pas encore prêts : une « cartouche vide » où l'on peut ajouter son fichier.
  const have = new Set(installed.map((g) => emulatedId(g.title)))
  // Les outils livrés sont des programmes Windows : sous Linux, ces jeux restent visibles mais marqués « indisponible ».
  const unavailableOn = process.platform === 'win32' ? undefined : 'Linux'
  const pending: Array<{ id: string; title: string }> =
    process.platform === 'win32'
      ? recipeList().filter((r) => r.state !== 'ready' && !have.has(emulatedId(r.title)))
      : loadRecipes(bundledDir('recipes')).filter((r) => !have.has(emulatedId(r.title)))
  const pendingTiles: Game[] = pending.map((r) => {
    const id = 'recipe:' + r.id
    const override = cfg.overrides[id]
    const cover = override?.icon && existsSync(override.icon) ? override.icon : coverOf(r.title)
    return {
      id,
      title: override?.title?.trim() || r.title,
      dir: '',
      exe: '',
      args: [],
      icon: cover ? imageDataUrl(cover) : null,
      lastPlayed: 0,
      available: false,
      recipeId: r.id,
      unavailableOn
    }
  })
  const taken = [...installed.map((g) => g.title), ...pending.map((r) => r.title)]
  return [...pendingTiles, ...(cfg.showMissingGames ? catalogMissing(taken, unavailableOn) : [])]
}

function catalogMissing(taken: string[], unavailableOn?: string): Game[] {
  const cfg = store.get()
  // Jeux Switch 2 du catalogue : réservés à Windows. Les jeux Pokémon passent par un émulateur livré : jouables partout.
  const entries: Array<{ id: string; title: string; emulatorId?: string; unavailableOn?: string }> = [
    ...missingEntries(taken).map((e) => ({ ...e, unavailableOn })),
    ...pokemonEntries(taken)
  ]
  return entries.map(({ id, title, emulatorId, unavailableOn: blocked }) => {
    const override = cfg.overrides[id]
    const shown = override?.title?.trim() || title
    const cover = override?.icon && existsSync(override.icon) ? override.icon : coverOf(title)
    return {
      id,
      title: shown,
      dir: '',
      exe: '',
      args: [],
      icon: cover ? imageDataUrl(cover) : null,
      lastPlayed: 0,
      available: false,
      emulatorId,
      unavailableOn: blocked
    }
  })
}

/** Jaquette d'un jeu : celle de l'utilisateur (dossier des jaquettes), sinon celle livrée avec le lanceur (dossier covers). */
function coverOf(title: string): string | null {
  return findCover(store.get().coversDir, title) ?? findCover(bundledDir('covers'), title)
}

/** Dossiers livrés avec le lanceur : les outils (émulateurs, recompilations) et les recettes qui les décrivent. */
const bundledDir = (name: string): string =>
  process.env.CL_BUNDLED ? join(process.env.CL_BUNDLED, name) : app.isPackaged ? join(process.resourcesPath, name) : join(app.getAppPath(), name)

/** Jeux à recette prêts à lancer ; un jeu ajouté à la main sous le même titre garde la priorité. */
function withRecipes(cfg: Config): Config {
  const own = new Set(cfg.emulated.map((e) => emulatedId(e.title)))
  if (process.platform !== 'win32') return cfg
  const extra = recipeEntries(loadRecipes(bundledDir('recipes')), recipePaths(), cfg.recipeInputs ?? {}).filter((e) => !own.has(emulatedId(e.title)))
  return extra.length ? { ...cfg, emulated: [...cfg.emulated, ...extra] } : cfg
}

/** Émulateur livré avec le lanceur (chemin du programme), ou rien s'il manque. */
function bundledEmulatorPath(id: string): string | undefined {
  const e = EMULATORS[id]
  const rel = e ? (process.platform === 'win32' ? e.bundledWin : e.bundledLinux) : undefined
  const path = rel ? join(bundledDir('emulators'), rel) : ''
  return path && existsSync(path) ? path : undefined
}

/**
 * Dossier « Jeux » livré à côté du lanceur (à côté du .exe, ou du fichier AppImage) : il existe avant le premier
 * lancement. Quand il est là, il sert de dossier des jeux ; sinon on utilise celui de la configuration.
 */
function portableRomsDir(): string {
  const base = process.env.APPIMAGE ? dirname(process.env.APPIMAGE) : app.isPackaged ? dirname(process.execPath) : ''
  const dir = base ? join(base, 'Jeux') : ''
  return dir && existsSync(dir) ? dir : ''
}

const romsFolder = (cfg: Config): string => portableRomsDir() || cfg.romsDir

/** Jeux déposés dans le dossier des jeux ; un jeu ajouté à la main sous le même titre garde la priorité. */
function withRoms(cfg: Config): Config {
  const own = new Set(cfg.emulated.map((e) => emulatedId(e.title)))
  const extra = romEntries(romsFolder(cfg), bundledEmulatorPath).filter((e) => !own.has(emulatedId(e.title)))
  return extra.length ? { ...cfg, emulated: [...cfg.emulated, ...extra] } : cfg
}

/** Windows : Pokémon Home (écran Applis) s'affiche dans la fenêtre du lanceur ; ailleurs, il s'ouvre à part. */
const homeView = new HomeView(() => win, log)

const recipePaths = (): RecipePaths => ({ toolsDir: bundledDir('tools'), outRoot: join(app.getPath('userData'), 'games') })

/** Préparations en cours (jeux dont le lanceur exécute lui-même l'outil), avec leur dernière ligne de progression. */
/** Dernier échec d'une préparation, affiché jusqu'à la prochaine tentative. */
const recipeLastError = new Map<string, string>()
const recipeRuns = new Map<string, { child: ChildProcess | null; progress: string }>()

const recipeList = (): RecipeInfo[] => {
  const inputs = store.get().recipeInputs ?? {}
  return loadRecipes(bundledDir('recipes')).map((r) => {
    const info = recipeInfo(r, recipePaths(), inputs)
    const run = recipeRuns.get(r.id)
    const failed = recipeLastError.get(r.id)
    return run ? { ...info, running: true, progress: run.progress } : failed ? { ...info, progress: failed } : info
  })
}

async function scan(): Promise<Game[]> {
  games = await scanLibrary(withRecipes(withRoms(store.get())))
  await fetchAppIcons(games)
  const installed = games.map(toGame)
  // Jeux Switch 2 (installés, puis « cartouches vides »), puis les jeux Pokémon du plus récent au plus ancien.
  const all = [...installed, ...missingGames(installed)]
  const pokemon = all
    .filter((g) => pokemonRank(g.title) !== -1)
    .sort((a, b) => pokemonRank(a.title) - pokemonRank(b.title))
    .map((g) => ({ ...g, pokemonConsole: pokemonConsole(g.title) ?? undefined }))
  // Une seule tuile « Pokémon » sur l'accueil : elle ouvre l'écran qui range tous ces jeux par console.
  const cover = findCover(store.get().coversDir, 'Pokémon') ?? findBackdrop(bundledDir('covers'), 'Pokémon')
  const tile: Game[] = pokemon.length
    ? [
        {
          id: 'collection:pokemon',
          title: 'Pokémon',
          dir: '',
          exe: '',
          args: [],
          icon: cover ? imageDataUrl(cover) : null,
          lastPlayed: 0,
          available: true,
          collection: 'pokemon'
        }
      ]
    : []
  const result = [...all.filter((g) => pokemonRank(g.title) === -1), ...tile, ...pokemon]
  log(
    'scan',
    result.map((g) => ({ titre: g.title, disponible: g.available, image: g.icon !== null }))
  )
  return result
}

/** Image réduite à `width` px de large (URL `data:`), ou l'image elle-même si elle est légère et non décodable. */
const themesRoot = (): string => join(app.getPath('userData'), 'themes')

const WALLPAPER_MIME: Record<string, string> = {
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif'
}

/** Fond d'écran prêt à afficher : png/jpg réduits à 1920 px, autres formats tels quels. */
function wallpaperUrl(file: string): string | null {
  const ext = extname(file).toLowerCase()
  try {
    if (statSync(file).size > MAX_WALLPAPER_BYTES) return null
    const mime = WALLPAPER_MIME[ext]
    if (mime) return `data:${mime};base64,${readFileSync(file).toString('base64')}`
    const image = nativeImage.createFromPath(file)
    if (image.isEmpty()) return null
    const resized = image.getSize().width > 1920 ? image.resize({ width: 1920, quality: 'best' }) : image
    return ext === '.png' ? resized.toDataURL() : `data:image/jpeg;base64,${resized.toJPEG(88).toString('base64')}`
  } catch (err) {
    log('fond d’écran illisible', file, String(err))
    return null
  }
}

function imageThumb(file: string, width: number): string | null {
  try {
    const image = nativeImage.createFromPath(file)
    if (!image.isEmpty()) {
      return image.getSize().width > width ? image.resize({ width, quality: 'best' }).toDataURL() : image.toDataURL()
    }
  } catch {
    // Format non géré par nativeImage (webp) : repli ci-dessous.
  }
  return imageDataUrl(file, 2 * 1024 * 1024)
}

const thumbCache = new Map<string, string | null>()

/** Miniature d'une image de l'album ; repli sur le fichier lui-même s'il est léger. */
async function albumThumb(file: string): Promise<string | null> {
  const key = `${file}|${statSync(file).mtimeMs}`
  if (thumbCache.has(key)) return thumbCache.get(key) ?? null
  let result: string | null = null
  try {
    const thumb = await nativeImage.createThumbnailFromPath(file, { width: 480, height: 270 })
    if (!thumb.isEmpty()) result = thumb.toDataURL()
  } catch {
    // Pas de miniature système (format non géré) : on essaie autrement.
  }
  if (!result) {
    const image = nativeImage.createFromPath(file)
    if (!image.isEmpty()) result = image.resize({ width: 480 }).toDataURL()
  }
  if (!result) result = imageDataUrl(file, 4 * 1024 * 1024)
  thumbCache.set(key, result)
  return result
}

const NEWS_TTL_MS = 30 * 60 * 1000
let newsCache: { url: string; at: number; items: NewsItem[] } | null = null

function newsCacheFile(): string {
  return join(app.getPath('userData'), 'news-cache.json')
}

function readNewsDisk(url: string): typeof newsCache {
  try {
    const raw = JSON.parse(readFileSync(newsCacheFile(), 'utf8'))
    return raw && raw.url === url && Array.isArray(raw.items) ? raw : null
  } catch {
    return null
  }
}

async function loadNews(force: boolean): Promise<NewsResult> {
  const url = safeHttpsUrl(store.get().newsFeedUrl)
  if (!url) return { items: [], fetchedAt: 0, stale: false, error: "Adresse du flux invalide (https requis)." }
  if (!newsCache || newsCache.url !== url) newsCache = readNewsDisk(url)
  if (!force && newsCache && newsCache.url === url && Date.now() - newsCache.at < NEWS_TTL_MS) {
    return { items: newsCache.items, fetchedAt: newsCache.at, stale: false }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await net.fetch(url, {
      signal: controller.signal,
      credentials: 'omit',
      headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' }
    })
    if (!res.ok) throw new Error(`Le serveur a répondu ${res.status}`)
    const text = await res.text()
    if (text.length > 3_000_000) throw new Error('Flux trop volumineux')
    const items = parseFeed(text)
    if (items.length === 0) throw new Error('Flux vide ou illisible')
    newsCache = { url, at: Date.now(), items }
    try {
      writeFileSync(newsCacheFile(), JSON.stringify(newsCache), 'utf8')
    } catch (err) {
      log('cache des actualités non enregistré', String(err))
    }
    return { items, fetchedAt: newsCache.at, stale: false }
  } catch (err) {
    const message = err instanceof Error && err.name === 'AbortError' ? 'Délai dépassé' : String(err instanceof Error ? err.message : err)
    log('actualités indisponibles', message)
    if (newsCache && newsCache.url === url) {
      return { items: newsCache.items, fetchedAt: newsCache.at, stale: true, error: message }
    }
    return { items: [], fetchedAt: 0, stale: false, error: message }
  } finally {
    clearTimeout(timer)
  }
}

function currentSsid(): Promise<NetworkInfo> {
  return new Promise((resolve) => {
    execFile('netsh.exe', ['wlan', 'show', 'interfaces'], { windowsHide: true, timeout: 5000 }, (err, stdout) =>
      resolve({ ssid: err ? null : parseSsid(String(stdout)), signal: err ? null : parseSignal(String(stdout)) })
    )
  })
}

function registerIpc(): void {
  ipcMain.handle('album:list', (): Promise<AlbumItem[]> => listImageFiles(store.get().albumDir))
  ipcMain.handle('album:thumb', async (_e, file: string) => {
    const dir = store.get().albumDir
    if (typeof file !== 'string' || !insideDir(dir, file) || !isImageFile(file)) return null
    try {
      return await albumThumb(file)
    } catch {
      return null
    }
  })
  ipcMain.handle('album:image', (_e, file: string) => {
    const dir = store.get().albumDir
    if (typeof file !== 'string' || !insideDir(dir, file) || !isImageFile(file)) return null
    return imageDataUrl(file, 40 * 1024 * 1024)
  })
  ipcMain.handle('album:delete', async (_e, file: string) => {
    const dir = store.get().albumDir
    if (typeof file !== 'string' || !insideDir(dir, file) || !isImageFile(file)) return false
    try {
      await shell.trashItem(file)
      log('capture envoyée à la corbeille', file)
      return true
    } catch (err) {
      log('suppression impossible', file, String(err))
      return false
    }
  })
  ipcMain.handle('album:openFolder', async () => {
    const dir = store.get().albumDir
    if (!dir) return
    try {
      await mkdir(dir, { recursive: true })
      const error = await shell.openPath(dir)
      if (error) log('dossier de l’album non ouvert', error)
    } catch (err) {
      log('dossier de l’album non ouvert', String(err))
    }
  })
  ipcMain.handle('news:fetch', (_e, force?: boolean) => loadNews(force === true))
  ipcMain.handle('system:openExternal', async (_e, url: string) => {
    if (typeof url !== 'string' || !isAllowedExternal(url)) {
      log('ouverture refusée', url)
      return false
    }
    await shell.openExternal(url)
    return true
  })
  ipcMain.handle('system:network', () => currentSsid())
  ipcMain.handle('system:power', (_e, action: PowerAction) => {
    const cmd = powerCommand(action)
    if (!cmd) return
    log('alimentation', action)
    execFile(cmd.file, cmd.args, { windowsHide: true }, (err) => {
      if (err) log('commande d’alimentation en échec', action, String(err))
    })
  })
  ipcMain.handle('audio:custom', (_e, name: unknown) => {
    if (!isAudioName(name)) return null
    // Les sons du thème actif passent avant le dossier de sons des réglages.
    const cfg = store.get()
    const theme = listThemes(themesRoot()).find((t) => t.id === cfg.activeTheme)
    const own = theme?.sounds ? soundsFolder(themesRoot(), theme.id) : null
    const file = (own ? findAudioFile(own, name) : null) ?? findAudioFile(cfg.audioDir, name)
    if (!file) return null
    try {
      return readFileSync(file)
    } catch (err) {
      log('audio illisible', file, String(err))
      return null
    }
  })
  ipcMain.handle('themes:list', () => listThemes(themesRoot()))
  ipcMain.handle('themes:wallpaper', (_e, id: unknown) => {
    if (typeof id !== 'string') return null
    const theme = listThemes(themesRoot()).find((t) => t.id === id)
    const file = theme ? wallpaperPath(themesRoot(), theme) : null
    return file ? wallpaperUrl(file) : null
  })
  ipcMain.handle('themes:previewWallpaper', (_e, file: unknown) => {
    if (typeof file !== 'string' || !existsSync(file) || !safeWallpaperName(basename(file))) return null
    return wallpaperUrl(file)
  })
  ipcMain.handle('themes:save', (_e, theme: Theme, source?: unknown) => {
    const picked = typeof source === 'string' && safeWallpaperName(basename(source)) ? source : undefined
    const saved = saveTheme(themesRoot(), normalizeTheme(theme, typeof theme?.id === 'string' ? theme.id : ''), picked)
    log('thème enregistré', saved.id)
    return saved
  })
  ipcMain.handle('themes:import', (_e, folder: unknown) => {
    if (typeof folder !== 'string') return null
    const theme = importTheme(themesRoot(), folder)
    log('thème importé', theme?.id ?? 'aucun theme.json')
    return theme
  })
  ipcMain.handle('themes:delete', async (_e, id: unknown) => {
    const folder = typeof id === 'string' && !isBuiltinTheme(id) ? themeFolder(themesRoot(), id) : null
    if (!folder || !existsSync(folder)) return false
    try {
      await shell.trashItem(folder)
      if (store.get().activeTheme === id) store.set({ activeTheme: 'clair', theme: 'light' })
      return true
    } catch (err) {
      log('thème non supprimé', String(err))
      return false
    }
  })
  ipcMain.handle('themes:openFolder', async () => {
    await mkdir(themesRoot(), { recursive: true })
    await shell.openPath(themesRoot())
  })
  ipcMain.handle('profile:images', () => {
    const cfg = store.get()
    const art: Record<string, ProfileArt> = {}
    for (const p of cfg.profiles) {
      const entry: ProfileArt = {}
      if (p.image && existsSync(p.image)) entry.image = imageDataUrl(p.image) ?? undefined
      const character = resolveCharacterFile(cfg.charactersDir, p.avatar)
      if (character) entry.character = imageThumb(character, 256) ?? undefined
      if (entry.image || entry.character) art[p.id] = entry
    }
    return art
  })
  ipcMain.handle('image:preview', (_e, file: unknown) => {
    if (typeof file !== 'string' || !isImageFile(file) || !existsSync(file)) return null
    return imageThumb(file, 256)
  })
  ipcMain.handle('characters:list', async (): Promise<CharacterSeries[]> => {
    const series = await listCharacterFiles(store.get().charactersDir)
    return series.map((s) => ({
      name: s.series,
      items: s.files.flatMap((f) => {
        const thumb = imageThumb(f.path, 160)
        return thumb ? [{ id: f.id, name: f.name, thumb }] : []
      })
    }))
  })

  ipcMain.handle('config:get', () => store.get())
  ipcMain.handle('config:set', (_e, patch: Partial<Config>) => {
    log('config modifiée', Object.keys(patch))
    const cfg = store.set(patch)
    if (patch.fullscreen !== undefined) win?.setFullScreen(cfg.fullscreen)
    if (patch.appTitle !== undefined || patch.appIcon !== undefined) applyBranding()
    if (patch.autoStart !== undefined) applyAutoStart(cfg.autoStart, cfg.appTitle)
    return cfg
  })
  ipcMain.handle('library:scan', () => scan())
  ipcMain.handle('library:findPrograms', (_e, dir: unknown) => (typeof dir === 'string' ? findPrograms(dir) : []))
  ipcMain.handle('game:stop', () => launcher.stop())
  // Sauvegardes des joueurs : profils, temps de jeu, dernières parties.
  const backupsDir = (): string => join(app.getPath('userData'), 'backups')
  const restoreFrom = (text: string): boolean => {
    const data = parseBackup(text)
    if (!data) return false
    // Une copie de l'état actuel d'abord : une restauration ne perd jamais rien.
    writeBackup(backupsDir(), takeSnapshot(store.get(), 'avant restauration'))
    store.set(restorePatch(data, store.get(), join(app.getPath('userData'), 'profile-photos')))
    pruneBackups(backupsDir(), 30)
    log('sauvegarde restaurée', data.profiles.map((p) => p.name))
    return true
  }
  ipcMain.handle('backups:list', () => listBackups(backupsDir()))
  ipcMain.handle('backups:create', () => {
    writeBackup(backupsDir(), takeSnapshot(store.get(), 'manuelle'))
    pruneBackups(backupsDir(), 30)
    return listBackups(backupsDir())
  })
  ipcMain.handle('backups:restore', (_e, name: unknown) => {
    if (typeof name !== 'string' || name !== basename(name) || !/^joueurs-[\w-]+\.json$/i.test(name)) return false
    const file = join(backupsDir(), name)
    return existsSync(file) && restoreFrom(readFileSync(file, 'utf8'))
  })
  ipcMain.handle('backups:export', async () => {
    const r = await dialog.showSaveDialog(win!, { defaultPath: 'sauvegarde-joueurs.json', filters: [{ name: 'Sauvegarde', extensions: ['json'] }] })
    if (r.canceled || !r.filePath) return null
    writeFileSync(r.filePath, JSON.stringify(takeSnapshot(store.get(), 'exportée')), 'utf8')
    return r.filePath
  })
  ipcMain.handle('backups:import', async () => {
    const r = await dialog.showOpenDialog(win!, { properties: ['openFile'], filters: [{ name: 'Sauvegarde', extensions: ['json'] }] })
    if (r.canceled || r.filePaths.length === 0) return false
    return restoreFrom(readFileSync(r.filePaths[0], 'utf8'))
  })
  ipcMain.handle('backups:folder', async () => {
    mkdirSync(backupsDir(), { recursive: true })
    await shell.openPath(backupsDir())
  })
  ipcMain.handle('apps:list', () =>
    APPS.map((a) => {
      const cover = coverOf(a.title)
      return { ...appInfo(a, appsRoot(app.getPath('userData')), bundledDir('emulators')), icon: cover ? imageDataUrl(cover) : null }
    })
  )
  ipcMain.handle('apps:page', async (_e, id: unknown) => {
    const def = APPS.find((a) => a.id === id)
    if (def) await shell.openExternal(def.page)
  })
  ipcMain.handle('apps:install', async (_e, id: unknown, file: unknown) => {
    const def = APPS.find((a) => a.id === id)
    if (!def || typeof file !== 'string') return 'Application inconnue.'
    const err = await installApp(def, appsRoot(app.getPath('userData')), file)
    log('installation de l’application', def.id, err ?? 'ok')
    return err
  })
  ipcMain.handle('apps:open', (_e, id: unknown) => {
    const def = APPS.find((a) => a.id === id)
    if (!def) return 'Application inconnue.'
    let exe: string | null
    try {
      exe = launchPath(def, appsRoot(app.getPath('userData')), bundledDir('emulators'))
    } catch (e) {
      return 'Impossible de préparer l’application : ' + (e instanceof Error ? e.message : String(e))
    }
    if (!exe) return 'Application non installée.'
    if (process.platform === 'win32' && def.id === 'pkvault') return homeView.open(exe)
    return startDetached(exe, join(app.getPath('userData'), 'apps', def.id + '.log'))
  })
  ipcMain.handle('apps:remove', (_e, id: unknown) => {
    const def = APPS.find((a) => a.id === id)
    if (def) removeApp(def, appsRoot(app.getPath('userData')))
  })
  ipcMain.handle('recipes:list', () => recipeList())
  ipcMain.handle('recipes:input', (_e, id: unknown, need: unknown, path: unknown) => {
    if (typeof id === 'string' && typeof need === 'string' && typeof path === 'string') {
      const all = store.get().recipeInputs ?? {}
      store.set({ recipeInputs: { ...all, [id]: { ...all[id], [need]: path } } })
    }
    return recipeList()
  })
  ipcMain.handle('recipes:setup', (_e, id: unknown) => {
    const recipe = loadRecipes(bundledDir('recipes')).find((r) => r.id === id)
    if (!recipe || recipeRuns.has(recipe.id)) return false
    const inputs = store.get().recipeInputs ?? {}
    log('préparation du jeu', recipe.id)
    recipeLastError.delete(recipe.id)
    const child = runSetup(
      recipe,
      recipePaths(),
      inputs,
      (line) => {
        const run = recipeRuns.get(recipe.id)
        const text = describeLine(line)
        if (run) run.progress = text.length > 160 ? text.slice(0, 160) : text
        if (line.startsWith('{') && line.includes('"type": "error"') || line.includes('"type":"error"')) recipeLastError.set(recipe.id, text)
      },
      (code) => {
        log('préparation terminée', recipe.id, code)
        recipeRuns.delete(recipe.id)
        if (code === 0) recipeLastError.delete(recipe.id)
        else if (!recipeLastError.has(recipe.id)) recipeLastError.set(recipe.id, 'La préparation s’est arrêtée (code ' + String(code) + ').')
      }
    )
    if (child && recipe.setup?.mode === 'cli') recipeRuns.set(recipe.id, { child, progress: '' })
    return child !== null
  })
  ipcMain.handle('recipes:cancel', (_e, id: unknown) => {
    const run = typeof id === 'string' ? recipeRuns.get(id) : undefined
    run?.child?.kill()
    return true
  })
  // Grande image de fond d'un jeu : celle choisie pour lui, sinon <titre>.jpg dans le dossier des fonds.
  ipcMain.handle('game:backdrop', (_e, id: unknown, title: unknown) => {
    if (typeof id !== 'string' || typeof title !== 'string') return null
    const cfg = store.get()
    const own = cfg.overrides[id]?.backdrop
    // Fond de l'utilisateur d'abord, sinon celui livré avec le lanceur (dossier backdrops).
    const file = own && existsSync(own) ? own : (findBackdrop(cfg.backdropsDir, title) ?? findBackdrop(bundledDir('backdrops'), title))
    return file ? imageDataUrl(file, MAX_BACKDROP_BYTES) : null
  })
  ipcMain.handle('game:launch', async (_e, id: string) => {
    const game = games.find((g) => g.id === id)
    if (!game) {
      log('lancement refusé : jeu non installé ou inconnu', id)
      return
    }
    if (launcher.isRunning) return
    const cfg = store.get()
    store.set({ lastPlayed: { ...cfg.lastPlayed, [id]: Date.now() } })
    // Fenêtre du jeu (émulé ou non) : titre du jeu et jaquette en icône, la même que dans le lanceur.
    const cover = game.iconPath ?? coverOf(game.title)
    const iconPng = cover ? await squareIconPng(cover) : null
    if (launcher.isRunning) return
    hideFallbackMs = game.emulated ? HIDE_FALLBACK_EMULATED_MS : HIDE_FALLBACK_MS
    // Chaque profil retrouve sa propre partie : on met en place la sienne avant de lancer le jeu.
    pendingSaves = null
    const setup = saveSetupFor(game)
    if (setup) {
      try {
        const how = savesStore().prepare(cfg.activeProfile, setup.key, setup.dirs)
        pendingSaves = { profile: cfg.activeProfile, key: setup.key, dirs: setup.dirs }
        log('sauvegardes du jeu prêtes', { profil: cfg.activeProfile, jeu: game.title, etat: how })
      } catch (e) {
        log('sauvegardes du jeu : préparation impossible, lancement sans changement', String(e))
      }
    }
    launcher.launch(game, iconPng)
  })
  ipcMain.handle('dialog:pickFolder', async () => {
    const r = await dialog.showOpenDialog(win!, { properties: ['openDirectory'] })
    return r.canceled ? null : r.filePaths[0]
  })
  ipcMain.handle('dialog:pickImage', async () => {
    const r = await dialog.showOpenDialog(win!, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'ico'] }]
    })
    return r.canceled ? null : r.filePaths[0]
  })
  ipcMain.handle('roms:open', async () => {
    const dir = romsFolder(store.get())
    ensureRomFolder(dir)
    await shell.openPath(dir)
    return dir
  })
  ipcMain.handle('roms:add', async () => {
    const r = await dialog.showOpenDialog(win!, {
      title: 'Choisis tes jeux',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Jeux Game Boy, GBA, DS, 3DS', extensions: ROM_EXTENSIONS }]
    })
    return r.canceled ? null : addRoms(romsFolder(store.get()), r.filePaths)
  })
  ipcMain.handle('roms:addFiles', (_e, files: unknown) =>
    addRoms(
      romsFolder(store.get()),
      Array.isArray(files) ? files.filter((f): f is string => typeof f === 'string').slice(0, 200) : []
    )
  )
  ipcMain.handle('emulators:bundled', () => {
    const found: Record<string, string> = {}
    for (const e of Object.values(EMULATORS)) {
      const rel = process.platform === 'win32' ? e.bundledWin : e.bundledLinux
      const path = rel ? join(bundledDir('emulators'), rel) : ''
      if (path && existsSync(path)) found[e.id] = path
    }
    return found
  })
  ipcMain.handle('library:installedGames', () => installedGames())
  ipcMain.handle('dialog:pickFile', async (_e, program: unknown) => {
    const exeOnly = program === true && process.platform === 'win32'
    const r = await dialog.showOpenDialog(win!, {
      title: program === true ? 'Choisis le programme du jeu' : undefined,
      properties: ['openFile'],
      filters: exeOnly ? [{ name: 'Programmes', extensions: ['exe'] }] : undefined
    })
    return r.canceled ? null : r.filePaths[0]
  })
  ipcMain.handle('window:toggleFullscreen', () => {
    if (!win) return
    const next = !win.isFullScreen()
    win.setFullScreen(next)
    store.set({ fullscreen: next })
  })
  ipcMain.handle('app:log', (_e, message: string) => log('interface', String(message).slice(0, 500)))
  ipcMain.handle('app:quit', () => app.quit())
}

function createWindow(): void {
  // Toujours plein écran au démarrage, quel que soit le dernier réglage enregistré.
  store.set({ fullscreen: true })
  const cfg = store.get()
  win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    fullscreen: true,
    title: cfg.appTitle?.trim() || DEFAULT_TITLE,
    autoHideMenuBar: true,
    backgroundColor: cfg.theme === 'dark' ? '#2b2b2b' : '#ebebeb',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      // La musique de menu doit pouvoir démarrer sans clic préalable.
      autoplayPolicy: 'no-user-gesture-required'
    }
  })
  win.setMenu(null)
  win.on('closed', () => {
    win = null
  })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  // L'interface ne quitte jamais sa page : seule la même adresse (rechargement) est permise.
  win.webContents.on('will-navigate', (e, url) => {
    if (url !== win?.webContents.getURL()) e.preventDefault()
  })
  win.webContents.on('will-attach-webview', (e) => e.preventDefault())
  // Le titre vient des réglages, pas de la page.
  win.on('page-title-updated', (e) => e.preventDefault())
  applyBranding()
  win.webContents.on('did-fail-load', (_e, code, description) => log('page non chargée', code, description))
  win.webContents.on('render-process-gone', (_e, details) => log('interface arrêtée', details))
  win.webContents.on('console-message', (_e, level, message) => {
    if (message.startsWith('[visite]') || level >= 2) log('interface', message)
  })

  // Diagnostic : CL_DIAG=<fichier> écrit l'état des tuiles et une capture, puis quitte.
  // CL_DIAG_KEYS="ArrowDown,Enter,..." envoie d'abord ces touches (une par seconde).
  const diagFile = process.env.CL_DIAG
  if (diagFile) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        for (const key of (process.env.CL_DIAG_KEYS ?? '').split(',').filter(Boolean)) {
          win!.webContents.sendInputEvent({ type: 'keyDown', keyCode: key })
          win!.webContents.sendInputEvent({ type: 'keyUp', keyCode: key })
          await new Promise((r) => setTimeout(r, Number(process.env.CL_DIAG_DELAY ?? 1200)))
        }
        if (process.env.CL_DIAG_CAPTURE) await takeCapture()
        const report = await win!.webContents.executeJavaScript(`(() => ({
          images: [...document.querySelectorAll('.tile-art img')].map((i) => ({
            charge: i.complete, largeur: i.naturalWidth, hauteur: i.naturalHeight
          })),
          tuilesSansImage: [...document.querySelectorAll('.tile-name')].map((n) => n.textContent),
          tuilesNonInstallees: document.querySelectorAll('.tile.missing').length,
          audio: window.__audioState ? window.__audioState() : null
        }))()`)
        writeFileSync(diagFile, JSON.stringify(report, null, 2), 'utf8')
        const shot = await win!.webContents.capturePage()
        writeFileSync(diagFile + '.png', shot.resize({ width: 1280 }).toPNG())
        app.quit()
      }, 3000)
    })
  }

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  // Relancer l'application ramène la fenêtre, même si elle est masquée pendant un jeu.
  app.on('second-instance', () => {
    log('seconde instance : fenêtre existante ramenée au premier plan')
    win?.show()
    win?.focus()
  })

  app.whenReady().then(() => {
    app.setAppUserModelId('local.console.launcher')
    // Aucune permission web (caméra, micro, géolocalisation, notifications…) n'est jamais accordée.
    electronSession.defaultSession.setPermissionRequestHandler((_wc, _perm, done) => done(false))
    // Version publiée : aucun script en ligne dans la page de l'interface (limite les dégâts d'une éventuelle injection).
    if (app.isPackaged) {
      electronSession.defaultSession.webRequest.onHeadersReceived((details, done) => {
        if (!details.url.startsWith('file:')) return done({})
        done({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [
              "default-src 'self'; img-src 'self' data:; media-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; connect-src 'self'"
            ]
          }
        })
      })
    }
    const data = app.getPath('userData')
    initLog(join(data, 'launcher.log'))
    store = new ConfigStore(join(data, 'config.json'))
    if (store.recovery) log(store.recovery)
    ensureRomFolder(romsFolder(store.get()))
    log('démarrage', {
      version: app.getVersion(),
      exe: process.execPath,
      donnees: data,
      surcharges: store.get().overrides
    })
    applyAutoStart(store.get().autoStart, store.get().appTitle)
    try {
      const made = autoBackup(join(data, 'backups'), store.get())
      if (made) log('sauvegarde automatique', made)
    } catch (e) {
      log('sauvegarde automatique impossible', String(e))
    }
    registerIpc()
    createWindow()
  })

  app.on('will-quit', () => {
    homeView.close()
    globalShortcut.unregisterAll()
    try {
      autoBackup(join(app.getPath('userData'), 'backups'), store.get())
    } catch {
      // Sauvegarde de fin de session : sans importance si elle échoue.
    }
  })
  app.on('window-all-closed', () => app.quit())
}
