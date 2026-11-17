import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import type { Api, GameState } from '../shared/types'

const api: Api = {
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (patch) => ipcRenderer.invoke('config:set', patch),
  scan: () => ipcRenderer.invoke('library:scan'),
  launch: (id) => ipcRenderer.invoke('game:launch', id),
  onGameState: (cb) => {
    const listener = (_e: IpcRendererEvent, state: GameState): void => cb(state)
    ipcRenderer.on('game:state', listener)
    return () => ipcRenderer.removeListener('game:state', listener)
  },
  pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
  openRomsFolder: () => ipcRenderer.invoke('roms:open'),
  addRoms: () => ipcRenderer.invoke('roms:add'),
  addRomFiles: (files) => ipcRenderer.invoke('roms:addFiles', files),
  onDropFiles: (cb) => {
    const over = (e: DragEvent): void => e.preventDefault()
    const drop = (e: DragEvent): void => {
      e.preventDefault()
      const files = Array.from(e.dataTransfer?.files ?? []).map((f) => webUtils.getPathForFile(f))
      if (files.length) cb(files)
    }
    window.addEventListener('dragover', over)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragover', over)
      window.removeEventListener('drop', drop)
    }
  },
  pickImage: () => ipcRenderer.invoke('dialog:pickImage'),
  pickFile: (program) => ipcRenderer.invoke('dialog:pickFile', program === true),
  installedGames: () => ipcRenderer.invoke('library:installedGames'),
  toggleFullscreen: () => ipcRenderer.invoke('window:toggleFullscreen'),
  log: (message) => ipcRenderer.invoke('app:log', message),
  quit: () => ipcRenderer.invoke('app:quit'),

  listAlbum: () => ipcRenderer.invoke('album:list'),
  albumThumb: (path) => ipcRenderer.invoke('album:thumb', path),
  albumImage: (path) => ipcRenderer.invoke('album:image', path),
  deleteAlbumItem: (path) => ipcRenderer.invoke('album:delete', path),
  openAlbumFolder: () => ipcRenderer.invoke('album:openFolder'),
  fetchNews: (force) => ipcRenderer.invoke('news:fetch', force),
  openExternal: (url) => ipcRenderer.invoke('system:openExternal', url),
  bundledEmulators: () => ipcRenderer.invoke('emulators:bundled'),
  networkInfo: () => ipcRenderer.invoke('system:network'),
  findPrograms: (dir) => ipcRenderer.invoke('library:findPrograms', dir),
  stopGame: () => ipcRenderer.invoke('game:stop'),
  listBackups: () => ipcRenderer.invoke('backups:list'),
  createBackup: () => ipcRenderer.invoke('backups:create'),
  restoreBackup: (name) => ipcRenderer.invoke('backups:restore', name),
  exportBackup: () => ipcRenderer.invoke('backups:export'),
  extractSave: (id) => ipcRenderer.invoke('game:extractSave', id),
  importBackup: () => ipcRenderer.invoke('backups:import'),
  openBackupFolder: () => ipcRenderer.invoke('backups:folder'),
  listApps: () => ipcRenderer.invoke('apps:list'),
  openAppPage: (id) => ipcRenderer.invoke('apps:page', id),
  installApp: (id, file) => ipcRenderer.invoke('apps:install', id, file),
  mediaState: () => ipcRenderer.invoke('media:state'),
  mediaControl: (action) => ipcRenderer.invoke('media:control', action),
  installAppAuto: (id) => ipcRenderer.invoke('apps:installAuto', id),
  openApp: (id) => ipcRenderer.invoke('apps:open', id),
  removeApp: (id) => ipcRenderer.invoke('apps:remove', id),
  listRecipes: () => ipcRenderer.invoke('recipes:list'),
  setRecipeInput: (id, need, path) => ipcRenderer.invoke('recipes:input', id, need, path),
  runRecipeSetup: (id) => ipcRenderer.invoke('recipes:setup', id),
  cancelRecipeSetup: (id) => ipcRenderer.invoke('recipes:cancel', id),
  gameBackdrop: (id, title) => ipcRenderer.invoke('game:backdrop', id, title),
  power: (action) => ipcRenderer.invoke('system:power', action),
  profileImages: () => ipcRenderer.invoke('profile:images'),
  listCharacters: () => ipcRenderer.invoke('characters:list'),
  previewImage: (path) => ipcRenderer.invoke('image:preview', path),
  customAudio: (name) => ipcRenderer.invoke('audio:custom', name),
  listThemes: () => ipcRenderer.invoke('themes:list'),
  themeWallpaper: (id) => ipcRenderer.invoke('themes:wallpaper', id),
  previewWallpaper: (path) => ipcRenderer.invoke('themes:previewWallpaper', path),
  saveTheme: (theme, wallpaperSource) => ipcRenderer.invoke('themes:save', theme, wallpaperSource),
  importTheme: (folder) => ipcRenderer.invoke('themes:import', folder),
  deleteTheme: (id) => ipcRenderer.invoke('themes:delete', id),
  openThemesFolder: () => ipcRenderer.invoke('themes:openFolder')
}

contextBridge.exposeInMainWorld('api', api)
