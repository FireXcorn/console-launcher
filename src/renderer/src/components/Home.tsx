import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { Game, Profile, ProfileArt } from '../../../shared/types'
import Avatar from './Avatar'
import {
  BagIcon,
  CardIcon,
  ChatIcon,
  GamepadIcon,
  GlobeIcon,
  ImageIcon,
  NewsIcon,
  PadIcon,
  PowerIcon,
  SettingsIcon,
  ShareIcon
} from './icons'
import StatusCluster from './StatusCluster'

export type DockId =
  | 'online'
  | 'chat'
  | 'news'
  | 'shop'
  | 'album'
  | 'share'
  | 'controllers'
  | 'card'
  | 'settings'
  | 'sleep'

/**
 * Barre du bas, dans l'ordre du menu HOME de la Switch 2 (page d'aide officielle de Nintendo) :
 * Nintendo Switch Online, GameChat, Actualités, Nintendo eShop, Album, GameShare, Manettes,
 * Carte de jeu virtuelle, Paramètres de la console, Mode veille. Couleurs d'après la capture de référence.
 */
export const DOCK: { id: DockId; label: string; color: string; icon: JSX.Element }[] = [
  { id: 'online', label: 'Nintendo Switch Online', color: '#e0252b', icon: <GlobeIcon /> },
  { id: 'chat', label: 'GameChat', color: '#e8862e', icon: <ChatIcon /> },
  { id: 'news', label: 'Actualités', color: '#3fa34d', icon: <NewsIcon /> },
  { id: 'shop', label: 'Nintendo eShop', color: '#e03a3a', icon: <BagIcon /> },
  { id: 'album', label: 'Album', color: '#2f6fe0', icon: <ImageIcon /> },
  { id: 'share', label: 'GameShare', color: '#2bb3c8', icon: <ShareIcon /> },
  { id: 'controllers', label: 'Manettes', color: 'var(--icon)', icon: <PadIcon /> },
  { id: 'card', label: 'Carte de jeu virtuelle', color: 'var(--icon)', icon: <CardIcon /> },
  { id: 'settings', label: 'Paramètres de la console', color: 'var(--icon)', icon: <SettingsIcon /> },
  { id: 'sleep', label: 'Mode veille', color: 'var(--icon)', icon: <PowerIcon /> }
]

export interface Focus {
  row: 'top' | 'games' | 'dock'
  game: number
  dock: number
  /** 0 = avatar, 1 = heure / Wi-Fi / batterie. */
  top: number
}

const MIN_SLOTS = 5
const VISIBLE_BEFORE_SCROLL = 3

let lastPointer = { x: -1, y: -1 }

/**
 * Vrai seulement si la souris a réellement bougé : quand la rangée défile sous un curseur
 * immobile, le navigateur émet des événements de survol qui ne doivent pas voler la sélection.
 */
function pointerMoved(e: { clientX: number; clientY: number }): boolean {
  // Le tout premier événement ne fait que révéler où le curseur se trouvait déjà au démarrage.
  const first = lastPointer.x === -1
  const moved = !first && (e.clientX !== lastPointer.x || e.clientY !== lastPointer.y)
  lastPointer = { x: e.clientX, y: e.clientY }
  return moved
}

/** Mention « Cartouche vide », placée au-dessus de la tuile (jamais sur l'image). */
function EmptyCartridge(): JSX.Element {
  return (
    <span className="cartridge-tag">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 3h8l3 3v15H7z" />
        <path d="M10 8v3M13 8v3" />
      </svg>
      Cartouche vide
    </span>
  )
}

function hue(text: string): number {
  let h = 0
  for (const ch of text) h = (h * 31 + ch.codePointAt(0)!) % 360
  return h
}

/** Grande image de fond du jeu (dossier des fonds ou image choisie pour lui), chargée à la demande et gardée en mémoire. */
function useBackdropArt(game: Game | null, enabled: boolean, games: Game[]): string | null {
  const cache = useMemo(() => new Map<string, string | null>(), [games])
  const key = game ? game.id : null
  const [art, setArt] = useState<{ key: string; url: string | null } | null>(null)
  useEffect(() => {
    if (!enabled || !game || !key) return undefined
    if (cache.has(key)) {
      setArt({ key, url: cache.get(key) ?? null })
      return undefined
    }
    let alive = true
    window.api
      .gameBackdrop(game.id, game.title)
      .then((url) => {
        cache.set(key, url)
        if (alive) setArt({ key, url })
      })
      .catch(() => {
        cache.set(key, null)
        if (alive) setArt({ key, url: null })
      })
    return () => {
      alive = false
    }
    // Seul le jeu sélectionné relance le chargement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, cache])
  return enabled && key && art?.key === key ? art.url : null
}

/**
 * Fond du jeu sélectionné : sa grande image couvre tout l'écran, derrière toute l'interface. À chaque changement de
 * jeu, l'ancienne image s'efface et la nouvelle apparaît en fondu. Un jeu sans grande image n'a pas de fond.
 */
function GameBackdrop({ art, active }: { art: string | null; active: boolean }): JSX.Element {
  const [layers, setLayers] = useState<{ k: number; art: string; out: boolean }[]>([])
  const counter = useRef(0)
  const shown = active ? art : null
  useEffect(() => {
    setLayers((ls) => {
      const current = ls.find((l) => !l.out)
      if (current?.art === shown) return ls
      const next = ls.map((l) => ({ ...l, out: true }))
      if (shown) next.push({ k: ++counter.current, art: shown, out: false })
      return next
    })
    const timer = setTimeout(() => setLayers((ls) => ls.filter((l) => !l.out)), 520)
    return () => clearTimeout(timer)
  }, [shown])
  return (
    <div className="backdrop" aria-hidden="true">
      {layers.map((l) => (
        <div key={l.k} className={`backdrop-layer${l.out ? ' out' : ''}`}>
          <div className="art-main">
            <img src={l.art} alt="" draggable={false} />
          </div>
          <div className="art-veil" />
        </div>
      ))}
    </div>
  )
}
interface TopBarProps {
  focus: Focus
  profile: Profile
  profiles: Profile[]
  art: Record<string, ProfileArt>
  onFocus: (f: Focus) => void
  onTop: (index: number) => void
  onPickProfile: (id: string) => void
}

function TopBar({ focus, profile, profiles, art, onFocus, onTop, onPickProfile }: TopBarProps): JSX.Element {
  const on = (i: number): boolean => focus.row === 'top' && focus.top === i
  return (
    <header className="topbar">
      {/* Tous les utilisateurs, comme sur la console ; celui qui joue est sélectionnable au clavier. */}
      <div className="profiles">
        {profiles.map((p) =>
          p.id === profile.id ? (
            <button
              key={p.id}
              className={`avatar${on(0) ? ' focused' : ''}`}
              title={p.name}
              onMouseMove={(e) => pointerMoved(e) && !on(0) && onFocus({ ...focus, row: 'top', top: 0 })}
              onClick={() => onTop(0)}
            >
              <Avatar profile={p} art={art[p.id]} />
            </button>
          ) : (
            <button key={p.id} className="avatar mini" title={p.name} onClick={() => onPickProfile(p.id)}>
              <Avatar profile={p} art={art[p.id]} />
            </button>
          )
        )}
      </div>
      <button
        className={`status${on(1) ? ' focused' : ''}`}
        title="État du système"
        onMouseMove={(e) => pointerMoved(e) && !on(1) && onFocus({ ...focus, row: 'top', top: 1 })}
        onClick={() => onTop(1)}
      >
        <StatusCluster />
      </button>
    </header>
  )
}

interface TileProps {
  game: Game
  focused: boolean
  launching: boolean
  onSelect: () => void
  onActivate: () => void
}

function GameTile({ game, focused, launching, onSelect, onActivate }: TileProps): JSX.Element {
  const h = hue(game.title)
  const fallback: CSSProperties = {
    background: `linear-gradient(145deg, hsl(${h} 62% 52%), hsl(${(h + 48) % 360} 68% 36%))`
  }
  // Une image qui ne se décode pas laisse place à la tuile générée plutôt qu'à un carré vide.
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [game.icon])
  const icon = broken ? null : game.icon
  const artRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState<{ rect: DOMRect; go: boolean } | null>(null)
  // Au lancement, l'image se détache de la rangée (qui masque ce qui dépasse) et grandit jusqu'à
  // remplir tout l'écran, comme l'icône du vrai menu.
  useEffect(() => {
    if (!launching || !artRef.current) return
    setZoom({ rect: artRef.current.getBoundingClientRect(), go: false })
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setZoom((z) => (z ? { ...z, go: true } : z))))
    return () => cancelAnimationFrame(id)
  }, [launching])
  return (
    <div
      className={`tile${focused ? ' focused' : ''}${launching ? ' launching' : ''}${game.available ? '' : ' missing'}`}
      onMouseMove={(e) => pointerMoved(e) && !focused && onSelect()}
      onClick={onActivate}
    >
      {launching &&
        zoom &&
        createPortal(
          <div
            className={`launch-zoom${zoom.go ? ' go' : ''}`}
            style={{ left: zoom.rect.left, top: zoom.rect.top, width: zoom.rect.width, height: zoom.rect.height, ...(icon ? undefined : fallback) }}
          >
            {icon && <img src={icon} alt="" draggable={false} />}
          </div>,
          document.body
        )}
      {focused && <div className="tile-title">{game.title}</div>}
      {!game.available && (
        <div className="tile-above">
          <EmptyCartridge />
        </div>
      )}
      <div className="tile-art" ref={artRef} style={icon ? undefined : fallback}>
        {icon ? (
          <img
            src={icon}
            alt=""
            draggable={false}
            onLoad={(e) =>
              window.api.log(
                `image affichée pour « ${game.title} » (${e.currentTarget.naturalWidth}x${e.currentTarget.naturalHeight})`
              )
            }
            onError={() => {
              window.api.log(`image non décodée pour « ${game.title} »`)
              setBroken(true)
            }}
          />
        ) : (
          <span className="tile-name">{game.title}</span>
        )}
      </div>
    </div>
  )
}

interface HomeProps {
  games: Game[]
  focus: Focus
  profile: Profile
  profiles: Profile[]
  profileArt: Record<string, ProfileArt>
  launchingId: string | null
  /** Fond animé du jeu sélectionné (réglage gameBackdrop). */
  backdrop: boolean
  confirmLabel: string
  onFocus: (f: Focus) => void
  onLaunch: (index: number) => void
  onDock: (id: DockId) => void
  onTop: (index: number) => void
  onPickProfile: (id: string) => void
}

export default function Home(props: HomeProps): JSX.Element {
  const { games, focus, profile, profiles, profileArt, launchingId, backdrop, confirmLabel, onFocus, onLaunch, onDock, onTop, onPickProfile } =
    props
  const placeholders = Math.max(0, MIN_SLOTS - games.length)
  const offset = Math.max(0, focus.game - VISIBLE_BEFORE_SCROLL)
  const onGames = focus.row === 'games' && games.length > 0
  const focusedGame = onGames ? (games[focus.game] ?? null) : null
  const art = useBackdropArt(focusedGame, backdrop, games)

  return (
    <div className={`home opening${backdrop ? ' backdrop-mode' : ''}${art && !launchingId ? ' has-art' : ''}`}>
      {backdrop && <GameBackdrop art={art} active={!launchingId} />}
      <TopBar
        focus={focus}
        profile={profile}
        profiles={profiles}
        art={profileArt}
        onFocus={onFocus}
        onTop={onTop}
        onPickProfile={onPickProfile}
      />
      <section className="row-viewport">
        <div className="row" style={{ '--offset': offset } as CSSProperties}>
          {games.map((g, i) => (
            <GameTile
              key={g.id}
              game={g}
              focused={onGames && focus.game === i}
              launching={launchingId === g.id}
              onSelect={() => onFocus({ ...focus, row: 'games', game: i })}
              onActivate={() => onLaunch(i)}
            />
          ))}
          {Array.from({ length: placeholders }, (_, i) => (
            <div key={`empty-${i}`} className="tile empty" />
          ))}
          {/* Un seul curseur pour toute la rangée : il glisse d'une tuile à l'autre. */}
          <span
            className={`cursor${onGames && !launchingId ? ' on' : ''}`}
            style={{ '--i': Math.min(focus.game, Math.max(0, games.length - 1)) } as CSSProperties}
          />
        </div>
        {games.length === 0 && (
          <p className="empty-hint">
            Aucun jeu trouvé. Ouvre « Réglages » pour choisir le dossier de tes jeux.
          </p>
        )}
      </section>

      <nav className="dock">
        <div className="dock-bar">
          <span
            className={`dock-cursor${focus.row === 'dock' ? ' on' : ''}`}
            style={{ '--i': focus.dock } as CSSProperties}
          />
          {DOCK.map((item, i) => {
            const focused = focus.row === 'dock' && focus.dock === i
            return (
              <button
                key={item.label}
                className={`dock-item${focused ? ' focused' : ''}${item.id === 'online' ? ' nso' : ''}`}
                style={{ '--item-color': item.color } as CSSProperties}
                onMouseMove={(e) =>
                  pointerMoved(e) && !focused && onFocus({ ...focus, row: 'dock', dock: i })
                }
                onClick={() => onDock(item.id)}
              >
                <span className="dock-icon">{item.icon}</span>
                {/* Clé = libellé : plusieurs entrées décoratives partagent l'identifiant `none`. */}
                <span className="dock-label">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      <footer className="footer">
        <span className="footer-glyph">
          <GamepadIcon />
        </span>
        <span className="footer-hints">
          {onGames && (
            <span className="hint">
              <span className="hint-key">+</span>
              Options
            </span>
          )}
          <span className="hint">
            <span className="hint-key">{confirmLabel}</span>
            {onGames ? 'Démarrer' : 'OK'}
          </span>
        </span>
      </footer>
    </div>
  )
}
