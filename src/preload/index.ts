import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
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
  pickImage: () => ipcRenderer.invoke('dialog:pickImage'),
  pickFile: () => ipcRenderer.invoke('dialog:pickFile'),
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
  networkInfo: () => ipcRenderer.invoke('system:network'),
  findPrograms: (dir) => ipcRenderer.invoke('library:findPrograms', dir),
  stopGame: () => ipcRenderer.invoke('game:stop'),
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
