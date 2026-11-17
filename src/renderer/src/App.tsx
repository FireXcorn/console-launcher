import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import type { AddRomsSummary, Config, Game, ProfileArt } from '../../shared/types'
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
import AddGame, { type AddKind } from './components/AddGame'
import RecipeGuide from './components/RecipeGuide'
import ToolGuide from './components/ToolGuide'
import Tour from './components/Tour'
import { useMedia } from './hooks/useMedia'
import AppsScreen from './screens/Apps'
import PokemonScreen from './screens/Pokemon'
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
  | 'apps'
  | 'pokemon'
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
  /** Jeu livré avec son outil dont on ajoute la cartouche (fenêtre guide). */
  const [guideGame, setGuideGame] = useState<{ recipeId: string; title: string } | null>(null)
  const [scanned, setScanned] = useState(false)
  const [settingsStart, setSettingsStart] = useState<string | undefined>(undefined)
  /** Jeu pour lequel on ajoute son propre outil (depuis une « Cartouche vide » du catalogue). */
  const [toolGame, setToolGame] = useState<{ title: string; emulatorId?: string } | null>(null)
  const [addTitle, setAddTitle] = useState<string | undefined>(undefined)
  const [addEmulator, setAddEmulator] = useState<string | undefined>(undefined)
  /** Assistant « Ajouter un jeu » : ouvert sur un type de jeu, ou sur les trois cartes ('choose'). */
  const [addKind, setAddKind] = useState<AddKind | 'choose' | null>(null)
  const [dropped, setDropped] = useState<AddRomsSummary | null>(null)
  const [running, setRunning] = useState(false)
  const { media, control: controlMedia } = useMedia(screen === 'home' && !running)
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

  // Ajout de jeux : un seul geste (choisir les fichiers, ou les glisser sur la fenêtre). Le lanceur les range et actualise.
  const showAdded = useCallback(
    async (r: AddRomsSummary | null) => {
      if (!r) return
      await rescan()
      const lines = [
        r.added.length ? `Ajouté : ${r.added.join(', ')}. Tu peux jouer tout de suite.` : '',
        ...r.skipped
      ].filter(Boolean)
      setNotice({ title: r.added.length ? 'Jeux ajoutés' : 'Rien n’a été ajouté', message: lines.join(' ') })
    },
    [rescan]
  )
  // Fichiers glissés sur la fenêtre : l'assistant ouvert affiche le résultat, sinon une simple fenêtre le résume.
  const addOpen = useRef(false)
  addOpen.current = addKind !== null
  useEffect(
    () =>
      window.api.onDropFiles(
        (files) =>
          void window.api.addRomFiles(files).then(async (r) => {
            if (!addOpen.current) return showAdded(r)
            await rescan()
            setDropped(r)
          })
      ),
    [showAdded, rescan]
  )

  // L'accueil montre une seule tuile « Pokémon » ; les jeux Pokémon sont dans son écran.
  const homeGames = useMemo(() => games.filter((g) => !g.pokemonConsole), [games])

  const launchGame = useCallback(
    (game: Game) => {
      if (launchingId) return
      if (game.unavailableOn) {
        engine.play('refuser')
        setNotice({
          title: `${game.title} : indisponible sur ${game.unavailableOn}`,
          message: `Ce jeu n'est pas jouable sur ${game.unavailableOn} pour l'instant : il ne fonctionne que sous Windows. Attends qu'une nouvelle version du lanceur sorte.`
        })
        return
      }
      if (!game.available) {
        // Jeu livré avec son outil : la fenêtre guide explique quoi apporter.
        if (game.recipeId) {
          engine.play('ouvrir')
          setGuideGame({ recipeId: game.recipeId, title: game.title })
          return
        }
        // Jeu du catalogue sans outil livré : le guide explique comment brancher le sien.
        engine.play('ouvrir')
        setToolGame({ title: game.title, emulatorId: game.emulatorId })
        return
      }
      engine.play('lancer')
      engine.fadeOutMusic(LAUNCH_ANIMATION_MS)
      setLaunchingId(game.id)
      launchTimer.current = window.setTimeout(() => window.api.launch(game.id), LAUNCH_ANIMATION_MS)
    },
    [launchingId]
  )

  const launch = useCallback(
    (index: number) => {
      const game = homeGames[index]
      if (!game || launchingId) return
      setFocus((f) => ({ ...f, row: 'games', game: index }))
      if (game.collection) {
        engine.play('ouvrir')
        setScreen('pokemon')
        return
      }
      launchGame(game)
    },
    [homeGames, launchingId, launchGame]
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
      case 'apps':
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
      // Mini lecteur : L / R = précédent / suivant, Y = pause / lecture (PageUp, PageDown, Suppr au clavier).
      if (media && (action === 'prevTab' || action === 'nextTab' || action === 'option')) {
        controlMedia(action === 'prevTab' ? 'previous' : action === 'nextTab' ? 'next' : 'playpause')
        return
      }

      const step = action === 'left' ? -1 : action === 'right' ? 1 : 0
      const clamp = (n: number, max: number): number => Math.min(Math.max(n, 0), max)
      if (action === 'menu') {
        // Bouton « + » : options du jeu sélectionné.
        if (focus.row === 'games' && homeGames[focus.game] && !homeGames[focus.game].collection) {
          engine.play('ouvrir')
          setOptionsId(homeGames[focus.game].id)
        }
      } else if (step !== 0) {
        setFocus((f) =>
          f.row === 'games'
            ? { ...f, game: clamp(f.game + step, Math.max(0, homeGames.length - 1)) }
            : f.row === 'dock'
              ? { ...f, dock: clamp(f.dock + step, DOCK.length - 1) }
              : { ...f, top: clamp(f.top + step, 1) }
        )
      } else if (action === 'down') {
        setFocus((f) =>
          f.row === 'top' ? { ...f, row: homeGames.length > 0 ? 'games' : 'dock' } : { ...f, row: 'dock' }
        )
      } else if (action === 'up') {
        setFocus((f) =>
          f.row === 'dock' && homeGames.length > 0 ? { ...f, row: 'games' } : f.row === 'top' ? f : { ...f, row: 'top' }
        )
      } else if (action === 'back') {
        setFocus((f) => (f.row === 'top' && homeGames.length === 0 ? { ...f, row: 'dock' } : { ...f, row: homeGames.length > 0 ? 'games' : f.row }))
      } else if (action === 'confirm') {
        if (focus.row === 'games') launch(focus.game)
        else if (focus.row === 'dock') dockAction(DOCK[focus.dock].id)
        else topAction(focus.top)
      }
    },
    [notice, launchingId, homeGames, focus, launch, dockAction, topAction, media, controlMedia]
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
        games={homeGames}
        focus={focus}
        profile={activeProfile}
        profiles={config.profiles}
        profileArt={profileArt}
        onPickProfile={(id) => void updateConfig({ activeProfile: id })}
        media={media}
        onMedia={controlMedia}
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

      {screen === 'home' && scanned && !config.onboarded && (
        <Welcome
          onAdd={setAddKind}
          onTour={() => void updateConfig({ onboarded: true })}
          onLater={() => void updateConfig({ onboarded: true, tourDone: true })}
        />
      )}

      {screen === 'home' && scanned && config.onboarded && !config.tourDone && !guideGame && !notice && !addKind && (
        <Tour onDone={() => void updateConfig({ tourDone: true })} />
      )}
      {screen === 'album' && <AlbumScreen config={config} onBack={back} />}
      {screen === 'news' && <NewsScreen onBack={back} />}
      {screen === 'apps' && <AppsScreen onBack={back} />}
      {screen === 'pokemon' && (
        <PokemonScreen games={games.filter((g) => g.pokemonConsole)} onPlay={(g) => (g.available ? launchGame(g) : setAddKind('retro'))} onAdd={() => setAddKind('retro')} backdrop={config.gameBackdrop !== false} onBack={back} />
      )}
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
          games={games.filter((g) => g.available && !g.collection)}
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
          games={games.filter((g) => g.available && !g.collection)}
          onChange={updateConfig}
          onBack={() => setScreen('usersettings')}
        />
      )}
      {screen === 'controllers' && <ControllersScreen config={config} onChange={updateConfig} onBack={back} />}
      {screen === 'card' && (
        <VirtualCardScreen
          config={config}
          games={games.filter((g) => !g.collection)}
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
          addForTitle={addTitle}
          addForEmulator={addEmulator}
          config={config}
          games={games.filter((g) => !g.collection)}
          art={profileArt}
          onSave={async (patch) => {
            await updateConfig(patch)
            await rescan()
            if (patch.audioDir !== undefined) engine.loadCustom()
          }}
          onRescan={() => void rescan()}
          onAddGame={setAddKind}
          onOpenUser={(id) => {
            setEditingId(id)
            setOrigin('console')
            setScreen('usersettings')
          }}
          onBack={() => {
            // Le prochain passage par Paramètres repart de zéro (plus de jeu « en cours d'ajout »).
            setSettingsStart(undefined)
            setAddTitle(undefined)
            setAddEmulator(undefined)
            back()
          }}
        />
      )}

      {addKind && (
        <AddGame
          start={addKind === 'choose' ? undefined : addKind}
          config={config}
          dropped={dropped}
          onSave={async (patch) => {
            await updateConfig(patch)
            await rescan()
          }}
          onRescan={rescan}
          onRecipe={(recipeId, title) => {
            setAddKind(null)
            setGuideGame({ recipeId, title })
          }}
          onClose={(added) => {
            setAddKind(null)
            setDropped(null)
            // Premier jeu ajouté depuis l'écran de bienvenue : on passe à l'accueil (la visite guidée suit).
            if (added && !config.onboarded) void updateConfig({ onboarded: true })
          }}
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

      {toolGame && (
        <ToolGuide
          title={toolGame.title}
          emulatorId={toolGame.emulatorId}
          onClose={() => setToolGame(null)}
          onAdd={() => {
            setAddTitle(toolGame.title)
            setAddEmulator(toolGame.emulatorId)
            setSettingsStart('emulator')
            setToolGame(null)
            setScreen('settings')
          }}
        />
      )}

      {guideGame && (
        <RecipeGuide
          recipeId={guideGame.recipeId}
          title={guideGame.title}
          onReady={() => void rescan()}
          onClose={() => setGuideGame(null)}
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
