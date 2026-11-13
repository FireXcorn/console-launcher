import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import type { Config, Game, ProfileArt } from '../../shared/types'
import { LINKS } from '../../shared/links'
import { clearProfilePlaytime } from '../../shared/playtime'
import { engine } from './audio/engine'
import { useActiveTheme } from './theme'
import { useMoveSound } from './audio/useSound'
import { PROFILE_COLORS } from './components/colors'
import GameOptions from './components/GameOptions'
import Home, { DOCK, type DockId, type Focus } from './components/Home'
import PowerMenu from './components/PowerMenu'
import StatusPanel from './components/StatusPanel'
import { useGamepad, type Action } from './hooks/useGamepad'
import { InputContext, type InputHandler, type InputSource, type InputStack } from './hooks/useInput'
import AlbumScreen from './screens/Album'
import ControllersScreen from './screens/Controllers'
import NewsScreen from './screens/News'
import ActivityScreen from './screens/Activity'
import EditIconScreen from './screens/EditIcon'
import EditNameScreen from './screens/EditName'
import MyPageScreen from './screens/MyPage'
import ProfilePicker from './screens/ProfilePicker'
import UserSettingsScreen from './screens/UserSettings'
import Welcome from './screens/Welcome'
import SettingsScreen from './screens/Settings'
import VirtualCardScreen from './screens/VirtualCard'

const LAUNCH_ANIMATION_MS = 550
/** Délai avant de rendre le son au retour d'un jeu : évite le tic de la sélection qui se replace. */
const RESUME_AUDIO_DELAY_MS = 400

const KEYS: Record<string, Action> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  Enter: 'confirm',
  Escape: 'back',
  Backspace: 'back',
  Delete: 'option',
  Tab: 'menu',
  PageUp: 'prevTab',
  PageDown: 'nextTab'
}

type ScreenId =
  | 'home'
  | 'album'
  | 'news'
  | 'mypage'
  | 'users'
  | 'usersettings'
  | 'editicon'
  | 'editname'
  | 'activity'
  | 'controllers'
  | 'card'
  | 'settings'

/** D'où l'on vient en ouvrant les paramètres d'un utilisateur : le retour y ramène. */
type UserOrigin = 'mypage' | 'users' | 'console'
type PanelId = 'status' | 'power' | null
interface Notice {
  title: string
  message: string
}

export default function App(): JSX.Element | null {
  const [config, setConfig] = useState<Config | null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [focus, setFocus] = useState<Focus>({ row: 'games', game: 0, dock: 0, top: 0 })
  const [screen, setScreen] = useState<ScreenId>('home')
  const [panel, setPanel] = useState<PanelId>(null)
  const [optionsId, setOptionsId] = useState<string | null>(null)
  const [profileArt, setProfileArt] = useState<Record<string, ProfileArt>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [origin, setOrigin] = useState<UserOrigin>('mypage')
  const askedProfile = useRef(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [scanned, setScanned] = useState(false)
  const [settingsStart, setSettingsStart] = useState<string | undefined>(undefined)
  const [running, setRunning] = useState(false)
  const [launchingId, setLaunchingId] = useState<string | null>(null)
  const launchTimer = useRef<number | undefined>(undefined)
  const resumeTimer = useRef<number | undefined>(undefined)
  const audioStarted = useRef(false)

  // Pile des écrans et fenêtres ouverts : seul le dernier reçoit les touches.
  const stack = useRef<MutableRefObject<InputHandler>[]>([])
  const inputStack = useMemo<InputStack>(
    () => ({
      push(ref) {
        stack.current.push(ref)
        return () => {
          stack.current = stack.current.filter((r) => r !== ref)
        }
      }
    }),
    []
  )

  const rescan = useCallback(async () => {
    const list = await window.api.scan()
    setGames(list)
    setScanned(true)
    setFocus((f) => ({
      ...f,
      row: list.length === 0 && f.row === 'games' ? 'dock' : f.row,
      game: Math.min(f.game, Math.max(0, list.length - 1))
    }))
    return list
  }, [])

  useEffect(() => {
    window.api.getConfig().then(setConfig)
    rescan()
    return window.api.onGameState((state) => {
      setRunning(state.status === 'running')
      window.clearTimeout(resumeTimer.current)
      if (state.status === 'running') {
        engine.setSuspended(true)
        return
      }
      resumeTimer.current = window.setTimeout(() => engine.setSuspended(false), RESUME_AUDIO_DELAY_MS)
      setLaunchingId(null)
      if (state.status === 'error') setNotice({ title: 'Impossible de démarrer le jeu', message: state.message })
      // Le dernier jeu lancé repasse en tête ; le temps de jeu vient d'être mis à jour.
      setFocus((f) => ({ ...f, row: 'games', game: 0 }))
      setScreen('home')
      setPanel(null)
      setOptionsId(null)
      window.api.getConfig().then(setConfig)
      rescan()
    })
  }, [rescan])

  // Thème actif : couleurs, fond d'écran, styles ; ses sons sont rechargés quand il change.
  useActiveTheme(config?.activeTheme, () => {
    if (audioStarted.current) void engine.loadCustom()
  })

  // Audio : réglages de l'utilisateur, puis musique de menu au premier chargement.
  // Pendant les paramètres, l'écran règle lui-même le son en direct.
  useEffect(() => {
    if (!config || screen === 'settings') return
    engine.configure({ sfx: config.sfxVolume, music: config.musicVolume, muted: config.muted })
    if (!audioStarted.current) {
      audioStarted.current = true
      engine.loadCustom().finally(() => engine.startMusic())
    }
  }, [config, screen])

  useEffect(() => {
    const unlock = (): void => engine.unlock()
    window.addEventListener('keydown', unlock)
    window.addEventListener('pointerdown', unlock)
    return () => {
      window.removeEventListener('keydown', unlock)
      window.removeEventListener('pointerdown', unlock)
    }
  }, [])

  // Images des profils (image personnelle, personnage du dossier) : rechargées quand l'une change.
  const artKey = config ? `${config.charactersDir}|${config.profiles.map((p) => `${p.id}=${p.image}=${p.avatar}`).join('|')}` : ''
  useEffect(() => {
    let alive = true
    window.api.profileImages().then((art) => alive && setProfileArt(art))
    return () => {
      alive = false
    }
  }, [artKey])

  // À l'ouverture, avec plusieurs utilisateurs, on demande qui joue.
  useEffect(() => {
    if (config && !askedProfile.current) {
      askedProfile.current = true
      if (config.profiles.length > 1) setScreen('users')
    }
  }, [config])

  useEffect(
    () => () => {
      window.clearTimeout(launchTimer.current)
      window.clearTimeout(resumeTimer.current)
    },
    []
  )

  const configRef = useRef<Config | null>(null)
  configRef.current = config

  const updateConfig = useCallback(async (patch: Partial<Config>) => {
    setConfig(await window.api.setConfig(patch))
  }, [])

  // Petit tic quand la sélection de l'accueil change (clavier, manette ou souris).
  useMoveSound(`${focus.row}:${focus.game}:${focus.dock}:${focus.top}`)

  const launch = useCallback(
    (index: number) => {
      const game = games[index]
      if (!game || launchingId) return
      setFocus((f) => ({ ...f, row: 'games', game: index }))
      if (!game.available) {
        // Exclusivité du catalogue : comme une cartouche absente, on ne démarre rien.
        engine.play('refuser')
        setNotice({
          title: 'Cartouche vide',
          message: `« ${game.title} » n’est pas installé sur ce PC. Une fois le jeu prêt, il pourra se lancer depuis ici.`
        })
        return
      }
      engine.play('lancer')
      engine.fadeOutMusic(LAUNCH_ANIMATION_MS)
      setLaunchingId(game.id)
      launchTimer.current = window.setTimeout(() => window.api.launch(game.id), LAUNCH_ANIMATION_MS)
    },
    [games, launchingId]
  )

  const dockAction = useCallback((id: DockId) => {
    engine.play('ouvrir')
    switch (id) {
      case 'online':
        void window.api.openExternal(LINKS.online)
        break
      case 'chat':
        void window.api.openExternal(LINKS.chat)
        break
      case 'shop':
        void window.api.openExternal(LINKS.shop)
        break
      case 'share':
        void window.api.openAlbumFolder()
        break
      case 'sleep':
        setPanel('power')
        break
      case 'news':
      case 'album':
      case 'controllers':
      case 'card':
      case 'settings':
        setScreen(id)
        break
    }
  }, [])

  const topAction = useCallback((index: number) => {
    engine.play('ouvrir')
    if (index === 0) {
      // Ma page : le point d'entrée du profil de l'utilisateur actif.
      setEditingId(configRef.current?.activeProfile ?? null)
      setOrigin('mypage')
      setScreen('mypage')
    } else setPanel('status')
  }, [])

  const handleAction = useCallback(
    (action: Action, source: InputSource) => {
      if (notice) {
        if (action === 'confirm' || action === 'back') {
          engine.play(action === 'back' ? 'retour' : 'valider')
          setNotice(null)
        }
        return
      }
      const top = stack.current[stack.current.length - 1]
      if (top) {
        if (action === 'confirm') engine.play('valider')
        else if (action === 'back') engine.play('retour')
        top.current(action, source)
        return
      }
      if (launchingId) return

      const step = action === 'left' ? -1 : action === 'right' ? 1 : 0
      const clamp = (n: number, max: number): number => Math.min(Math.max(n, 0), max)
      if (action === 'menu') {
        // Bouton « + » : options du jeu sélectionné.
        if (focus.row === 'games' && games[focus.game]) {
          engine.play('ouvrir')
          setOptionsId(games[focus.game].id)
        }
      } else if (step !== 0) {
        setFocus((f) =>
          f.row === 'games'
            ? { ...f, game: clamp(f.game + step, Math.max(0, games.length - 1)) }
            : f.row === 'dock'
              ? { ...f, dock: clamp(f.dock + step, DOCK.length - 1) }
              : { ...f, top: clamp(f.top + step, 1) }
        )
      } else if (action === 'down') {
        setFocus((f) =>
          f.row === 'top' ? { ...f, row: games.length > 0 ? 'games' : 'dock' } : { ...f, row: 'dock' }
        )
      } else if (action === 'up') {
        setFocus((f) =>
          f.row === 'dock' && games.length > 0 ? { ...f, row: 'games' } : f.row === 'top' ? f : { ...f, row: 'top' }
        )
      } else if (action === 'back') {
        setFocus((f) => (f.row === 'top' && games.length === 0 ? { ...f, row: 'dock' } : { ...f, row: games.length > 0 ? 'games' : f.row }))
      } else if (action === 'confirm') {
        if (focus.row === 'games') launch(focus.game)
        else if (focus.row === 'dock') dockAction(DOCK[focus.dock].id)
        else topAction(focus.top)
      }
    },
    [notice, launchingId, games, focus, launch, dockAction, topAction]
  )

  // L'écouteur est posé une seule fois et lit toujours l'état du dernier rendu.
  const latest = useRef({ handleAction })
  latest.current = { handleAction }

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'F11') {
        e.preventDefault()
        window.api.toggleFullscreen()
        return
      }
      const action = KEYS[e.key]
      if (!action) return
      // Pendant une saisie ou dans une zone marquée `data-native-input` (paramètres, options), le clavier
      // garde son rôle habituel (écrire, cocher, régler un curseur, tabuler) : seul Échap est intercepté.
      const target = e.target
      const typing =
        target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
      const native = target instanceof Element && target.closest('[data-native-input]') !== null
      if ((typing || native) && e.key !== 'Escape') return
      e.preventDefault()
      latest.current.handleAction(action, 'key')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useGamepad((a) => handleAction(a, 'pad'), !running, config?.swapConfirm ?? false)

  if (!config) return null

  const back = (): void => setScreen('home')
  const optionsGame = optionsId ? games.find((g) => g.id === optionsId) : undefined
  const activeProfile = config.profiles.find((p) => p.id === config.activeProfile) ?? config.profiles[0]

  const addProfile = async (): Promise<void> => {
    const n = config.profiles.length + 1
    const profile = {
      id: `p${Date.now().toString(36)}`,
      name: `Joueur ${n}`,
      color: PROFILE_COLORS[Math.floor(Math.random() * PROFILE_COLORS.length)],
      background: '',
      avatar: '',
      image: ''
    }
    profile.background = `c:${profile.color}`
    await updateConfig({ profiles: [...config.profiles, profile] })
    // Comme sur la console, un nouvel utilisateur commence par le choix de son icône.
    setEditingId(profile.id)
    setOrigin('users')
    setScreen('editicon')
  }

  const editing = editingId ? config.profiles.find((p) => p.id === editingId) : undefined
  const backFromUser = (): void => setScreen(origin === 'console' ? 'settings' : origin)
  const saveProfile = (patch: Partial<typeof config.profiles[number]>): void => {
    if (!editing) return
    void updateConfig({ profiles: config.profiles.map((p) => (p.id === editing.id ? { ...p, ...patch } : p)) })
  }

  return (
    <InputContext.Provider value={inputStack}>
      <div className="wallpaper" aria-hidden="true" />
      <Home
        games={games}
        focus={focus}
        profile={activeProfile}
        profiles={config.profiles}
        profileArt={profileArt}
        onPickProfile={(id) => void updateConfig({ activeProfile: id })}
        launchingId={launchingId}
        backdrop={config?.gameBackdrop !== false}
        confirmLabel="A"
        onFocus={(f) => !launchingId && setFocus(f)}
        onLaunch={launch}
        onDock={dockAction}
        onTop={topAction}
      />

      {launchingId && (
        <div className="launch-fade">
          <span className="launch-text">{running ? 'Chargement du jeu…' : 'Lancement…'}</span>
        </div>
      )}

      {screen === 'home' && scanned && !config.onboarded && !games.some((g) => g.available) && (
        <Welcome
          onImport={async () => {
            const dir = await window.api.pickFolder()
            if (!dir) return 0
            const known = new Set(config.emulated.map((g) => g.emulatorExe.toLowerCase()))
            const found = (await window.api.findPrograms(dir)).filter((c) => !known.has(c.exe.toLowerCase()))
            if (found.length === 0) return 0
            await updateConfig({
              onboarded: true,
              emulated: [...config.emulated, ...found.map((c) => ({ title: c.title, emulatorExe: c.exe, gameFile: '', args: [], readyTitle: '' }))]
            })
            await rescan()
            return found.length
          }}
          onManual={() => {
            void updateConfig({ onboarded: true })
            setSettingsStart('emulator')
            setScreen('settings')
          }}
          onLater={() => void updateConfig({ onboarded: true })}
        />
      )}
      {screen === 'album' && <AlbumScreen config={config} onBack={back} />}
      {screen === 'news' && <NewsScreen onBack={back} />}
      {screen === 'mypage' && editing && (
        <MyPageScreen
          profile={editing}
          art={profileArt[editing.id]}
          onSettings={() => setScreen('usersettings')}
          onUsers={() => setScreen('users')}
          onBack={back}
        />
      )}
      {screen === 'users' && (
        <ProfilePicker
          config={config}
          art={profileArt}
          onSelect={async (id) => {
            await updateConfig({ activeProfile: id })
            back()
          }}
          onEdit={(id) => {
            setEditingId(id)
            setOrigin('users')
            setScreen('usersettings')
          }}
          onAdd={addProfile}
          onBack={back}
        />
      )}
      {screen === 'usersettings' && editing && (
        <UserSettingsScreen
          config={config}
          profileId={editing.id}
          games={games.filter((g) => g.available)}
          art={profileArt[editing.id]}
          onEditIcon={() => setScreen('editicon')}
          onEditName={() => setScreen('editname')}
          onActivity={() => setScreen('activity')}
          onDelete={async () => {
            const profiles = config.profiles.filter((p) => p.id !== editing.id)
            await updateConfig({
              profiles,
              activeProfile: config.activeProfile === editing.id ? profiles[0].id : config.activeProfile,
              playtime: clearProfilePlaytime(config, editing.id)
            })
            setScreen('users')
          }}
          onBack={backFromUser}
        />
      )}
      {screen === 'editicon' && editing && (
        <EditIconScreen
          config={config}
          profileId={editing.id}
          art={profileArt[editing.id]}
          onSave={(patch) => {
            saveProfile(patch)
            setScreen('usersettings')
          }}
          onBack={() => setScreen('usersettings')}
        />
      )}
      {screen === 'editname' && editing && (
        <EditNameScreen
          name={editing.name}
          onSave={(name) => {
            saveProfile({ name })
            setScreen('usersettings')
          }}
          onBack={() => setScreen('usersettings')}
        />
      )}
      {screen === 'activity' && editing && (
        <ActivityScreen
          config={config}
          profileId={editing.id}
          games={games.filter((g) => g.available)}
          onChange={updateConfig}
          onBack={() => setScreen('usersettings')}
        />
      )}
      {screen === 'controllers' && <ControllersScreen config={config} onChange={updateConfig} onBack={back} />}
      {screen === 'card' && (
        <VirtualCardScreen
          config={config}
          games={games}
          onToggleMissing={async () => {
            await updateConfig({ showMissingGames: !config.showMissingGames })
            await rescan()
          }}
          onBack={back}
        />
      )}
      {screen === 'settings' && (
        <SettingsScreen
          startCategory={settingsStart}
          config={config}
          games={games}
          art={profileArt}
          onSave={async (patch) => {
            await updateConfig(patch)
            await rescan()
            if (patch.audioDir !== undefined) engine.loadCustom()
          }}
          onRescan={() => void rescan()}
          onOpenUser={(id) => {
            setEditingId(id)
            setOrigin('console')
            setScreen('usersettings')
          }}
          onBack={back}
        />
      )}

      {panel === 'status' && <StatusPanel onClose={() => setPanel(null)} />}
      {panel === 'power' && <PowerMenu initialIndex={1} onClose={() => setPanel(null)} onQuit={() => window.api.quit()} />}

      {optionsGame && (
        <GameOptions
          game={optionsGame}
          config={config}
          onChange={async (patch) => {
            await updateConfig(patch)
            await rescan()
          }}
          onClose={() => setOptionsId(null)}
        />
      )}

      {notice && (
        <div className="overlay">
          <div className="dialog small" role="alertdialog">
            <h2>{notice.title}</h2>
            <p>{notice.message}</p>
            <div className="dialog-actions">
              <button className="primary" onClick={() => setNotice(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </InputContext.Provider>
  )
}
