import { useCallback, useEffect, useState } from 'react'
import { COLOR_KEYS, type Theme, findTheme, themeVars } from '../../shared/theme'

export const THEMES_CHANGED = 'themes-changed'

/** À appeler après avoir enregistré, importé ou supprimé un thème : l'accueil relit la liste. */
export function announceThemesChanged(): void {
  window.dispatchEvent(new Event(THEMES_CHANGED))
}

const EXTRA_VARS = ['--tile-radius', '--text-dim', '--accent-soft', '--wallpaper', '--wallpaper-dim']

/** Pose un thème sur la page : couleurs, arrondi, styles et fond d'écran (null = pas de fond). */
export function applyTheme(theme: Theme, wallpaperUrl: string | null): void {
  const root = document.documentElement
  for (const key of [...COLOR_KEYS.map((k) => `--${k}`), ...EXTRA_VARS]) root.style.removeProperty(key)
  for (const [name, value] of Object.entries(themeVars(theme))) root.style.setProperty(name, value)
  root.dataset.theme = theme.base
  root.dataset.dock = theme.dockStyle
  root.dataset.dockcolors = theme.dockColors
  root.dataset.cursor = theme.cursor
  if (wallpaperUrl) {
    root.style.setProperty('--wallpaper', `url("${wallpaperUrl}")`)
    root.style.setProperty('--wallpaper-dim', String(theme.wallpaperDim))
    root.dataset.wallpaper = 'on'
  } else {
    delete root.dataset.wallpaper
  }
}

/** Thèmes de l'utilisateur, relus quand `announceThemesChanged` est appelé. */
export function useUserThemes(): Theme[] {
  const [themes, setThemes] = useState<Theme[]>([])
  const load = useCallback(() => {
    window.api.listThemes().then(setThemes)
  }, [])
  useEffect(() => {
    load()
    window.addEventListener(THEMES_CHANGED, load)
    return () => window.removeEventListener(THEMES_CHANGED, load)
  }, [load])
  return themes
}

/** Applique le thème actif de la configuration (et recharge ses sons quand il change). */
export function useActiveTheme(activeId: string | undefined, onChanged: () => void): void {
  const userThemes = useUserThemes()
  useEffect(() => {
    if (!activeId) return
    let alive = true
    const theme = findTheme(activeId, userThemes)
    const apply = (url: string | null): void => {
      if (alive) applyTheme(theme, url)
    }
    if (theme.wallpaper) window.api.themeWallpaper(theme.id).then(apply)
    else apply(null)
    return () => {
      alive = false
    }
  }, [activeId, userThemes])
  useEffect(() => {
    if (activeId) onChanged()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])
}
