import { useEffect, useRef, useState } from 'react'
import { BUILTIN_THEMES, COLOR_KEYS, COLOR_LABELS, type ColorKey, type Theme, isBuiltinTheme } from '../../../shared/theme'
import { announceThemesChanged, applyTheme, useUserThemes } from '../theme'

interface Props {
  activeId: string
  /** Un thème vient d'être choisi (ou enregistré) : il devient le thème actif. */
  onSelect: (theme: Theme) => void
  /** Mode des jeux : avec ou sans leur grande image derrière les jaquettes. */
  gameBackdrop: boolean
  onGameBackdrop: (on: boolean) => void
}

/** Couleurs de base des deux jeux de couleurs (pour les cartes et les sélecteurs). */
const BASE_COLORS: Record<'light' | 'dark', Record<ColorKey, string>> = {
  light: { bg: '#ebedef', surface: '#ffffff', slot: '#f7f9fb', bar: '#f5f7f9', icon: '#5a5a5a', text: '#2c2c2c', accent: '#2f6fe0' },
  dark: { bg: '#2b2b2b', surface: '#3a3a3a', slot: '#343434', bar: '#383838', icon: '#cfcfcf', text: '#f4f4f4', accent: '#5aa2ff' }
}

const colorOf = (t: Theme, key: ColorKey): string => t.colors[key] ?? BASE_COLORS[t.base][key]

function Card({ theme, on, onPick }: { theme: Theme; on: boolean; onPick: () => void }): JSX.Element {
  return (
    <button className={`theme-card${on ? ' on' : ''}`} onClick={onPick} aria-pressed={on}>
      <span className="theme-mini" style={{ background: colorOf(theme, 'bg') }}>
        <span className="theme-mini-row">
          {[0, 1, 2].map((i) => (
            <i key={i} style={{ background: colorOf(theme, 'slot'), borderRadius: `${theme.tileRadius * 2}px` }} />
          ))}
        </span>
        <span className="theme-mini-bar" style={{ background: theme.dockStyle === 'floating' ? 'transparent' : colorOf(theme, 'bar') }}>
          <b style={{ background: colorOf(theme, 'accent') }} />
          <b style={{ background: colorOf(theme, 'icon') }} />
          <b style={{ background: colorOf(theme, 'icon') }} />
        </span>
      </span>
      <span className="theme-name">{theme.name}</span>
    </button>
  )
}

/**
 * Thèmes : choisir un thème, le modifier en direct (fond d'écran, couleurs, tuiles, barre, curseur, sons),
 * l'enregistrer, importer ou ouvrir le dossier des thèmes.
 */
export default function ThemesPanel({ activeId, onSelect, gameBackdrop, onGameBackdrop }: Props): JSX.Element {
  const userThemes = useUserThemes()
  const all = [...BUILTIN_THEMES, ...userThemes]
  const current = all.find((t) => t.id === activeId) ?? BUILTIN_THEMES[0]
  const [draft, setDraft] = useState<Theme>(current)
  const [picked, setPicked] = useState<string | undefined>()
  const [pickedUrl, setPickedUrl] = useState<string | null>(null)
  const [savedUrl, setSavedUrl] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const draftId = useRef(draft.id)
  draftId.current = draft.id

  // Le fond enregistré du thème qui sert de départ.
  useEffect(() => {
    let alive = true
    if (draft.wallpaper && !isBuiltinTheme(draft.id)) window.api.themeWallpaper(draft.id).then((u) => alive && setSavedUrl(u))
    else setSavedUrl(null)
    return () => {
      alive = false
    }
  }, [draft.id, draft.wallpaper])

  const wallpaperUrl = picked ? pickedUrl : draft.wallpaper ? savedUrl : null

  // Aperçu en direct : tout changement du brouillon est appliqué à la page.
  useEffect(() => {
    applyTheme(draft, wallpaperUrl)
  }, [draft, wallpaperUrl])

  // En quittant, la page revient au thème réellement enregistré.
  useEffect(() => () => announceThemesChanged(), [])

  const choose = (theme: Theme): void => {
    setDraft(theme)
    setPicked(undefined)
    setPickedUrl(null)
    setMessage('')
    onSelect(theme)
  }

  const patch = (change: Partial<Theme>): void => setDraft((d) => ({ ...d, ...change }))
  const setColor = (key: ColorKey, value: string): void => setDraft((d) => ({ ...d, colors: { ...d.colors, [key]: value } }))

  const pickWallpaper = async (): Promise<void> => {
    const file = await window.api.pickImage()
    if (!file) return
    const url = await window.api.previewWallpaper(file)
    if (!url) {
      setMessage('Cette image ne peut pas servir de fond (png, jpg, webp, avif ou gif de 15 Mo maximum).')
      return
    }
    setPicked(file)
    setPickedUrl(url)
    patch({ wallpaper: 'wallpaper' + (file.match(/\.[^.\\/]+$/)?.[0] ?? '.png') })
    setMessage('')
  }

  const save = async (asNew: boolean): Promise<void> => {
    const input = asNew || isBuiltinTheme(draft.id) ? { ...draft, id: '' } : draft
    const saved = await window.api.saveTheme(input, picked)
    announceThemesChanged()
    setPicked(undefined)
    setPickedUrl(null)
    setDraft(saved)
    onSelect(saved)
    setMessage(`Thème « ${saved.name} » enregistré.`)
  }

  const importFolder = async (): Promise<void> => {
    const folder = await window.api.pickFolder()
    if (!folder) return
    const theme = await window.api.importTheme(folder)
    if (!theme) {
      setMessage('Ce dossier ne contient pas de theme.json.')
      return
    }
    announceThemesChanged()
    choose(theme)
    setMessage(`Thème « ${theme.name} » importé.`)
  }

  const remove = async (): Promise<void> => {
    if (isBuiltinTheme(draft.id)) return
    if (await window.api.deleteTheme(draft.id)) {
      announceThemesChanged()
      choose(BUILTIN_THEMES[0])
      setMessage('Thème envoyé à la corbeille.')
    }
  }

  const seg = <T extends string>(value: T, options: [T, string][], set: (v: T) => void): JSX.Element => (
    <div className="field-row">
      {options.map(([v, label]) => (
        <button key={v} className={value === v ? 'primary' : ''} onClick={() => set(v)}>
          {label}
        </button>
      ))}
    </div>
  )

  return (
    <>
      <div className="theme-grid">
        {all.map((t) => (
          <Card key={t.id} theme={t} on={draft.id === t.id} onPick={() => choose(t)} />
        ))}
      </div>

      <div className="field">
        <span>Fond des jeux</span>
        {seg(gameBackdrop ? 'image' : 'none', [['none', 'Sans thème'], ['image', 'Image du jeu derrière les jaquettes']], (mode) => onGameBackdrop(mode === 'image'))}
        <small className="theme-msg">
          Avec l’image, le jeu sélectionné affiche sa grande image sur tout l’écran (dossier des fonds de jeux, réglé dans Bibliothèque). Un jeu sans grande image n’a pas de fond. S’applique après « Enregistrer » de la fenêtre des paramètres.
        </small>
      </div>

      <h3>Personnaliser « {draft.name} »</h3>
      <label className="field">
        <span>Nom</span>
        <input value={draft.name} maxLength={40} onChange={(e) => patch({ name: e.target.value })} />
      </label>

      <div className="field">
        <span>Fond d’écran</span>
        <div className="field-row">
          <button onClick={() => void pickWallpaper()}>Choisir une image…</button>
          <button
            disabled={!draft.wallpaper}
            onClick={() => {
              setPicked(undefined)
              setPickedUrl(null)
              patch({ wallpaper: '' })
            }}
          >
            Retirer
          </button>
        </div>
        <label className="theme-range">
          <small>Voile sombre : {Math.round(draft.wallpaperDim * 100)} %</small>
          <input type="range" min={0} max={0.7} step={0.05} value={draft.wallpaperDim} onChange={(e) => patch({ wallpaperDim: Number(e.target.value) })} />
        </label>
      </div>

      <div className="field">
        <span>Jeu de couleurs</span>
        {seg(draft.base, [['light', 'Clair'], ['dark', 'Sombre']], (base) => patch({ base, colors: {} }))}
      </div>

      <div className="field">
        <span>Couleurs</span>
        <div className="theme-colors">
          {COLOR_KEYS.map((key) => (
            <label key={key} className="theme-color">
              <input type="color" value={colorOf(draft, key)} onChange={(e) => setColor(key, e.target.value)} />
              <small>{COLOR_LABELS[key]}</small>
            </label>
          ))}
        </div>
        <button onClick={() => patch({ colors: {} })}>Rétablir les couleurs du jeu choisi</button>
      </div>

      <label className="field">
        <span>Arrondi des tuiles</span>
        <input type="range" min={0} max={3} step={0.1} value={draft.tileRadius} onChange={(e) => patch({ tileRadius: Number(e.target.value) })} />
      </label>

      <div className="field">
        <span>Barre du bas</span>
        {seg(draft.dockStyle, [['bar', 'Avec fond'], ['floating', 'Flottante']], (dockStyle) => patch({ dockStyle }))}
      </div>
      <div className="field">
        <span>Icônes de la barre</span>
        {seg(draft.dockColors, [['color', 'Colorées'], ['mono', 'Une couleur']], (dockColors) => patch({ dockColors }))}
      </div>
      <div className="field">
        <span>Curseur</span>
        {seg(draft.cursor, [['iridescent', 'Irisé'], ['solid', 'Uni']], (cursor) => patch({ cursor }))}
      </div>

      <label className="check">
        <input type="checkbox" checked={draft.sounds} onChange={(e) => patch({ sounds: e.target.checked })} />
        Utiliser les sons du thème (dossier « sounds » : menu, deplacer, valider, retour, lancer, refuser)
      </label>

      <div className="field-row theme-actions">
        <button className="primary" onClick={() => void save(false)}>
          {isBuiltinTheme(draft.id) ? 'Enregistrer comme nouveau thème' : 'Enregistrer le thème'}
        </button>
        {!isBuiltinTheme(draft.id) && <button onClick={() => void save(true)}>Enregistrer une copie</button>}
        <button onClick={() => void importFolder()}>Importer un dossier de thème…</button>
        <button onClick={() => void window.api.openThemesFolder()}>Ouvrir le dossier des thèmes</button>
        {!isBuiltinTheme(draft.id) && <button onClick={() => void remove()}>Supprimer</button>}
      </div>
      <small className="theme-msg">{message || 'Les changements s’affichent en direct ; enregistre pour les garder.'}</small>
    </>
  )
}
