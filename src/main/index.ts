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
  shell
} from 'electron'
import { execFile } from 'child_process'
import { existsSync, readFileSync, statSync, writeFileSync } from 'fs'
import { mkdir, writeFile } from 'fs/promises'
import { basename, extname, join } from 'path'
import { playtimeKey } from '../shared/playtime'
import { applyAutoStart } from './autostart'
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
  PowerAction
} from '../shared/types'
import { captureFileName, insideDir, isImageFile, listImageFiles } from './album'
import { findAudioFile, isAudioName } from './audio'
import { findBackdrop, findCover, missingEntries } from './catalog'
import { findPrograms } from './importer'
import { ConfigStore } from './config'
import { Launcher } from './launcher'
import { scanLibrary, type ScannedGame } from './library'
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
let session: { id: string; start: number } | null = null
let captureKeyRegistered: string | null = null

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

const launcher: Launcher = new Launcher(
  (state: GameState) => {
    log('jeu', state)
    if (state.status === 'running') {
      session = { id: state.id, start: Date.now() }
      registerCapture()
      registerStop()
    } else {
      unregisterCapture()
      unregisterStop()
      if (session) {
        const seconds = Math.round((Date.now() - session.start) / 1000)
        if (seconds >= 5) addPlaytime(session.id, seconds)
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
  const image = iconPath ?? findCover(store.get().coversDir, g.title)
  return { ...rest, icon: image ? imageDataUrl(image) : null, available: true }
}

/** Exclusivités Switch 2 absentes de la bibliothèque : affichées, jamais lançables. */
function missingGames(installed: Game[]): Game[] {
  const cfg = store.get()
  if (!cfg.showMissingGames) return []
  return missingEntries(installed.map((g) => g.title)).map(({ id, title }) => {
    const override = cfg.overrides[id]
    const shown = override?.title?.trim() || title
    const cover = override?.icon && existsSync(override.icon) ? override.icon : findCover(cfg.coversDir, title)
    return {
      id,
      title: shown,
      dir: '',
      exe: '',
      args: [],
      icon: cover ? imageDataUrl(cover) : null,
      lastPlayed: 0,
      available: false
    }
  })
}

async function scan(): Promise<Game[]> {
  games = await scanLibrary(store.get())
  const installed = games.map(toGame)
  const result = [...installed, ...missingGames(installed)]
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
  // Grande image de fond d'un jeu : celle choisie pour lui, sinon <titre>.jpg dans le dossier des fonds.
  ipcMain.handle('game:backdrop', (_e, id: unknown, title: unknown) => {
    if (typeof id !== 'string' || typeof title !== 'string') return null
    const cfg = store.get()
    const own = cfg.overrides[id]?.backdrop
    const file = own && existsSync(own) ? own : findBackdrop(cfg.backdropsDir, title)
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
    const cover = game.iconPath ?? findCover(cfg.coversDir, game.title)
    const iconPng = cover ? await squareIconPng(cover) : null
    if (launcher.isRunning) return
    hideFallbackMs = game.emulated ? HIDE_FALLBACK_EMULATED_MS : HIDE_FALLBACK_MS
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
  ipcMain.handle('dialog:pickFile', async () => {
    const r = await dialog.showOpenDialog(win!, { properties: ['openFile'] })
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
  const cfg = store.get()
  win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    fullscreen: cfg.fullscreen,
    title: cfg.appTitle?.trim() || DEFAULT_TITLE,
    autoHideMenuBar: true,
    backgroundColor: cfg.theme === 'dark' ? '#2b2b2b' : '#ebebeb',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // La musique de menu doit pouvoir démarrer sans clic préalable.
      autoplayPolicy: 'no-user-gesture-required'
    }
  })
  win.setMenu(null)
  win.on('closed', () => {
    win = null
  })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  // Le titre vient des réglages, pas de la page.
  win.on('page-title-updated', (e) => e.preventDefault())
  applyBranding()
  win.webContents.on('did-fail-load', (_e, code, description) => log('page non chargée', code, description))
  win.webContents.on('render-process-gone', (_e, details) => log('interface arrêtée', details))

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
    const data = app.getPath('userData')
    initLog(join(data, 'launcher.log'))
    store = new ConfigStore(join(data, 'config.json'))
    if (store.recovery) log(store.recovery)
    log('démarrage', {
      version: app.getVersion(),
      exe: process.execPath,
      donnees: data,
      surcharges: store.get().overrides
    })
    applyAutoStart(store.get().autoStart, store.get().appTitle)
    registerIpc()
    createWindow()
  })

  app.on('will-quit', () => globalShortcut.unregisterAll())
  app.on('window-all-closed', () => app.quit())
}
