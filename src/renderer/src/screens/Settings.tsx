import { useEffect, useRef, useState } from 'react'
import type { Config, EmulatedGame, Game, GameOverride, BackupInfo, ProfileArt, ProgramCandidate } from '../../../shared/types'
import { engine } from '../audio/engine'
import { useMoveSound } from '../audio/useSound'
import Avatar from '../components/Avatar'
import RecipeCard, { useRecipes } from '../components/RecipeCard'
import Screen from '../components/Screen'
import { useInput } from '../hooks/useInput'
import ThemesPanel from './ThemesPanel'

/** Jeu émulé en cours de saisie : les arguments restent du texte tant qu'on écrit. */
type EmuDraft = Omit<EmulatedGame, 'args'> & { args: string }

function parseArgs(text: string): string[] {
  return (text.match(/"[^"]*"|\S+/g) ?? []).map((a) => a.replace(/^"|"$/g, ''))
}

function formatArgs(args: string[]): string {
  return args.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ')
}

const CATEGORIES = [
  { id: 'users', label: 'Utilisateurs' },
  { id: 'backups', label: 'Sauvegardes' },
  { id: 'library', label: 'Bibliothèque' },
  { id: 'emulator', label: 'Ajouter des jeux' },
  { id: 'themes', label: 'Thèmes' },
  { id: 'display', label: 'Écran' },
  { id: 'sound', label: 'Son' },
  { id: 'controllers', label: 'Manettes' },
  { id: 'album', label: 'Album et captures' },
  { id: 'news', label: 'Actualités' },
  { id: 'advanced', label: 'Avancé' }
] as const

interface Props {
  config: Config
  games: Game[]
  /** Images des profils (pour la liste des utilisateurs). */
  art: Record<string, ProfileArt>
  /** Enregistre les réglages (appelé en quittant l'écran). */
  onSave: (patch: Partial<Config>) => Promise<void>
  onRescan: () => void
  /** Ouvre les paramètres d'un utilisateur (les réglages en cours sont enregistrés avant). */
  onOpenUser: (id: string) => void
  onBack: () => void
  /** Catégorie ouverte au départ (identifiant), par exemple « emulator » pour ajouter des jeux. */
  startCategory?: string
}

/**
 * « Paramètres de la console » : catégories à gauche, réglages à droite. Comme sur la console, les
 * changements sont appliqués en quittant l'écran.
 */
export default function SettingsScreen({ config, games, art, onSave, onRescan, onOpenUser, onBack, startCategory }: Props): JSX.Element {
  const [cat, setCat] = useState(() => Math.max(0, CATEGORIES.findIndex((c) => c.id === startCategory)))
  const paneRef = useRef<HTMLDivElement>(null)

  const [gamesDir, setGamesDir] = useState(config.gamesDir)
  const [launchExe, setLaunchExe] = useState(config.launchExe)
  const [args, setArgs] = useState(formatArgs(config.launchArgs))
  const [fullscreen, setFullscreen] = useState(config.fullscreen)
  const [autoStart, setAutoStart] = useState(config.autoStart)
  const [gameBackdrop, setGameBackdrop] = useState(config.gameBackdrop !== false)
  const [theme, setTheme] = useState(config.theme)
  const [activeTheme, setActiveTheme] = useState(config.activeTheme)
  const [swapConfirm, setSwapConfirm] = useState(config.swapConfirm)
  const [overrides, setOverrides] = useState<Record<string, GameOverride>>(config.overrides)
  const [appTitle, setAppTitle] = useState(config.appTitle)
  const [appIcon, setAppIcon] = useState(config.appIcon)
  const [albumDir, setAlbumDir] = useState(config.albumDir)
  const [captureKey, setCaptureKey] = useState(config.captureKey)
  const [newsFeedUrl, setNewsFeedUrl] = useState(config.newsFeedUrl)
  const [showMissing, setShowMissing] = useState(config.showMissingGames)
  const [coversDir, setCoversDir] = useState(config.coversDir)
  const [backdropsDir, setBackdropsDir] = useState(config.backdropsDir)
  const [audioDir, setAudioDir] = useState(config.audioDir)
  const [musicVolume, setMusicVolume] = useState(config.musicVolume)
  const [sfxVolume, setSfxVolume] = useState(config.sfxVolume)
  const [muted, setMuted] = useState(config.muted)
  const [emulated, setEmulated] = useState<EmuDraft[]>(config.emulated.map((g) => ({ ...g, args: formatArgs(g.args) })))
  const [charactersDir, setCharactersDir] = useState(config.charactersDir)
  const [showAdvanced, setShowAdvanced] = useState(config.showAdvanced === true)
  useMoveSound(cat)

  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [backupNote, setBackupNote] = useState('')
  const [confirmRestore, setConfirmRestore] = useState('')
  useEffect(() => {
    void window.api.listBackups().then(setBackups)
  }, [])

  const createBackup = async (): Promise<void> => {
    setBackups(await window.api.createBackup())
    setBackupNote('Sauvegarde créée.')
  }
  const exportBackup = async (): Promise<void> => {
    const file = await window.api.exportBackup()
    setBackupNote(file ? 'Enregistrée : ' + file : 'Export annulé.')
  }
  /** Après une restauration, l'écran est rechargé pour repartir des données restaurées. */
  const restoreBackup = async (name: string): Promise<void> => {
    const ok = await window.api.restoreBackup(name)
    setConfirmRestore('')
    if (ok) location.reload()
    else setBackupNote('Cette sauvegarde n’est pas lisible.')
  }
  const importBackup = async (): Promise<void> => {
    if (await window.api.importBackup()) location.reload()
    else setBackupNote('Import annulé ou fichier non valable.')
  }

  const { recipes, setRecipes } = useRecipes()

  const [candidates, setCandidates] = useState<(ProgramCandidate & { on: boolean })[] | null>(null)
  const [importNote, setImportNote] = useState('')

  /** Titre proposé pour un fichier : son nom sans extension ni signes de séparation. */
  const titleFromPath = (path: string): string => {
    const name = (path.split(/[\\/]/).pop() ?? path).replace(/\.[^.]+$/, '')
    return name.replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').replace(/[_.]+/g, ' ').replace(/\s+/g, ' ').trim() || name
  }

  const addPcGame = async (): Promise<void> => {
    const exe = await window.api.pickFile()
    if (!exe) return
    setEmulated((list) => [...list, { title: titleFromPath(exe), emulatorExe: exe, gameFile: '', args: '', readyTitle: '' }])
  }

  const addEmulatedGame = async (): Promise<void> => {
    const emulator = await window.api.pickFile()
    if (!emulator) return
    const game = await window.api.pickFile()
    setEmulated((list) => [
      ...list,
      { title: game ? titleFromPath(game) : '', emulatorExe: emulator, gameFile: game ?? '', args: '-f -g {game}', readyTitle: '' }
    ])
  }

  const importFolder = async (): Promise<void> => {
    const dir = await window.api.pickFolder()
    if (!dir) return
    const known = new Set(emulated.map((g) => g.emulatorExe.toLowerCase()))
    const found = (await window.api.findPrograms(dir)).filter((c) => !known.has(c.exe.toLowerCase()))
    setImportNote('Aucun nouveau jeu trouvé dans ce dossier (un programme par sous-dossier est cherché).')
    setCandidates(found.map((c) => ({ ...c, on: true })))
  }

  const addCandidates = (): void => {
    const chosen = (candidates ?? []).filter((c) => c.on)
    setEmulated((list) => [...list, ...chosen.map((c) => ({ title: c.title, emulatorExe: c.exe, gameFile: '', args: '', readyTitle: '' }))])
    setCandidates(null)
  }

  const patchEmu = (i: number, patch: Partial<EmuDraft>): void =>
    setEmulated((list) => list.map((g, j) => (j === i ? { ...g, ...patch } : g)))

  const pickInto = async (i: number, field: 'emulatorExe' | 'gameFile'): Promise<void> => {
    const file = await window.api.pickFile()
    if (file) patchEmu(i, { [field]: file })
  }

  const patchOverride = (id: string, patch: GameOverride): void =>
    setOverrides((o) => ({ ...o, [id]: { ...o[id], ...patch } }))

  const pickFolderInto = async (set: (v: string) => void): Promise<void> => {
    const dir = await window.api.pickFolder()
    if (dir) set(dir)
  }

  const save = async (): Promise<void> => {
    await onSave({
      charactersDir: charactersDir.trim(),
      showAdvanced,
      gamesDir: gamesDir.trim(),
      launchExe: launchExe.trim(),
      launchArgs: parseArgs(args),
      fullscreen,
      autoStart,
      gameBackdrop,
      theme,
      activeTheme,
      swapConfirm,
      overrides,
      appTitle: appTitle.trim(),
      appIcon: appIcon.trim(),
      albumDir: albumDir.trim(),
      captureKey: captureKey.trim(),
      newsFeedUrl: newsFeedUrl.trim(),
      showMissingGames: showMissing,
      coversDir: coversDir.trim(),
      backdropsDir: backdropsDir.trim(),
      audioDir: audioDir.trim(),
      musicVolume,
      sfxVolume,
      muted,
      // Les entrées incomplètes sont écartées ; les réglages avancés (journal, signal…) sont conservés.
      emulated: emulated
        .filter((g) => g.title.trim() && g.emulatorExe.trim() && (g.gameFile.trim() || !g.args.includes('{game}')))
        .map((g) => ({
          ...g,
          title: g.title.trim(),
          emulatorExe: g.emulatorExe.trim(),
          gameFile: g.gameFile.trim(),
          args: parseArgs(g.args),
          readyTitle: g.readyTitle.trim()
        }))
    })
  }

  const leave = async (): Promise<void> => {
    await save()
    onBack()
  }

  /** Relance la visite guidée : les réglages sont enregistrés, puis l'accueil la montre. */
  const replayTour = async (): Promise<void> => {
    await save()
    await onSave({ tourDone: false })
    onBack()
  }

  const openUser = async (id: string): Promise<void> => {
    await save()
    onOpenUser(id)
  }

  useInput((action) => {
    const pane = paneRef.current
    const inPane = pane !== null && pane.contains(document.activeElement) && document.activeElement !== pane
    if (action === 'back') {
      if (inPane) (document.activeElement as HTMLElement).blur()
      else void leave()
    } else if (action === 'up') setCat((c) => Math.max(0, c - 1))
    else if (action === 'down') setCat((c) => Math.min(CATEGORIES.length - 1, c + 1))
    else if (action === 'confirm') pane?.querySelector<HTMLElement>('input, button, select')?.focus()
  })

  const folderRow = (label: string, value: string, set: (v: string) => void, note?: string): JSX.Element => (
    <label className="field">
      <span>{label}</span>
      <div className="field-row">
        <input value={value} onChange={(e) => set(e.target.value)} />
        <button onClick={() => pickFolderInto(set)}>Parcourir…</button>
      </div>
      {note && <small>{note}</small>}
    </label>
  )

  const content = ((): JSX.Element => {
    switch (CATEGORIES[cat].id) {
      case 'users':
        return (
          <>
            <p className="settings-note">Choisis un utilisateur pour modifier son icône, son pseudo et son activité de jeu.</p>
            <div className="user-rows">
              {config.profiles.map((p) => (
                <button key={p.id} className="user-row" onClick={() => void openUser(p.id)}>
                  <span className="user-row-avatar">
                    <Avatar profile={p} art={art[p.id]} />
                  </span>
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
            {folderRow(
              'Dossier de personnages',
              charactersDir,
              setCharactersDir,
              'Dépose tes images de personnages ici : chaque sous-dossier devient une série dans « Modifier l’icône ».'
            )}
          </>
        )
      case 'library':
        return (
          <>
            {folderRow('Dossier des jeux', gamesDir, setGamesDir, 'Le dossier lui-même et ses sous-dossiers directs sont analysés.')}
            {showAdvanced && (
            <div className="field-pair">
              <label className="field">
                <span>Exécutable à lancer</span>
                <input value={launchExe} onChange={(e) => setLaunchExe(e.target.value)} />
                <small>Relatif au dossier du jeu.</small>
              </label>
              <label className="field">
                <span>Arguments</span>
                <input value={args} onChange={(e) => setArgs(e.target.value)} />
                <small>{'{dir}'} = dossier du jeu.</small>
              </label>
            </div>
            )}
            {folderRow(
              'Dossier des jaquettes',
              coversDir,
              setCoversDir,
              "Une image nommée comme le jeu (ex. « Mario Kart World.png ») s'affiche sur sa tuile."
            )}
            {folderRow(
              'Dossier des fonds de jeux',
              backdropsDir,
              setBackdropsDir,
              "Une grande image nommée comme le jeu (ex. « Mario Kart World.jpg ») s'affiche derrière le menu quand il est sélectionné."
            )}
            <label className="check">
              <input type="checkbox" checked={showMissing} onChange={(e) => setShowMissing(e.target.checked)} />
              Afficher les exclusivités Switch 2 non installées
            </label>
            <button onClick={onRescan}>Actualiser la bibliothèque</button>
            {games.length > 0 && (
              <>
                <h3>Jeux</h3>
                <div className="game-list">
                  {games.map((g) => (
                    <div key={g.id} className="game-edit">
                      <input
                        value={overrides[g.id]?.title ?? g.title}
                        onChange={(e) => patchOverride(g.id, { title: e.target.value })}
                        aria-label={`Titre de ${g.title}`}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )
      case 'emulator':
        return (
          <>
            <p className="settings-note">
              Ajoute un jeu en choisissant son programme. Pour un jeu sur émulateur, choisis aussi le fichier du jeu. Tu peux aussi
              importer d’un coup tous les jeux d’un dossier.
            </p>
            {recipes.length > 0 && (
              <div className="emu-card recipes">
                <h3>Jeux livrés avec leur outil</h3>
                <p className="settings-note">
                  Donne ton propre fichier de jeu : le lanceur s’occupe de l’outil. Le jeu apparaît dans le menu dès qu’il est prêt
                  (actualise la bibliothèque).
                </p>
                {recipes.map((r) => (
                  <RecipeCard key={r.id} recipe={r} onChange={setRecipes} />
                ))}
              </div>
            )}
            <div className="field-row wrap">
              <button className="primary" onClick={() => void addPcGame()}>
                Ajouter un jeu PC…
              </button>
              <button onClick={() => void addEmulatedGame()}>Ajouter un jeu sur émulateur…</button>
              <button onClick={() => void importFolder()}>Importer un dossier de jeux…</button>
            </div>

            {candidates && (
              <div className="emu-card">
                <h3>Jeux trouvés</h3>
                {candidates.length === 0 && <p className="settings-note">{importNote}</p>}
                {candidates.map((c, i) => (
                  <label key={c.exe} className="check">
                    <input
                      type="checkbox"
                      checked={c.on}
                      onChange={(e) => setCandidates((list) => (list ?? []).map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))}
                    />
                    {c.title} <small>{c.exe}</small>
                  </label>
                ))}
                <div className="field-row">
                  {candidates.some((c) => c.on) && <button className="primary" onClick={addCandidates}>Ajouter la sélection</button>}
                  <button onClick={() => setCandidates(null)}>Fermer</button>
                </div>
              </div>
            )}

            {emulated.length === 0 && !candidates && <p className="settings-note">Aucun jeu ajouté à la main pour l’instant.</p>}
            {emulated.map((g, i) => {
              const withFile = g.gameFile.trim() !== '' || g.args.includes('{game}')
              return (
                <div className="emu-card" key={i}>
                  <label className="field">
                    <span>Titre du jeu</span>
                    <input value={g.title} onChange={(e) => patchEmu(i, { title: e.target.value })} />
                  </label>
                  <label className="field">
                    <span>{withFile ? 'Programme de l’émulateur' : 'Programme du jeu'}</span>
                    <div className="field-row">
                      <input value={g.emulatorExe} onChange={(e) => patchEmu(i, { emulatorExe: e.target.value })} />
                      <button onClick={() => pickInto(i, 'emulatorExe')}>Parcourir…</button>
                    </div>
                  </label>
                  {withFile && (
                    <label className="field">
                      <span>Fichier du jeu</span>
                      <div className="field-row">
                        <input value={g.gameFile} onChange={(e) => patchEmu(i, { gameFile: e.target.value })} />
                        <button onClick={() => pickInto(i, 'gameFile')}>Parcourir…</button>
                      </div>
                    </label>
                  )}
                  {showAdvanced && (
                    <>
                  <label className="field">
                    <span>Arguments</span>
                    <input value={g.args} onChange={(e) => patchEmu(i, { args: e.target.value })} />
                    <small>
                      {withFile
                        ? '{game} = fichier du jeu. L’émulateur reste caché derrière un écran noir jusqu’au jeu.'
                        : 'Laisse vide si tu n’es pas sûr : un programme qui ne connaît pas une option s’arrête.'}
                    </small>
                  </label>
                  <label className="field">
                    <span>Titre de la fenêtre du jeu (avancé)</span>
                    <input value={g.readyTitle} onChange={(e) => patchEmu(i, { readyTitle: e.target.value })} />
                    <small>Une expression qui reconnaît la fenêtre du jeu : l’écran noir part dès qu’elle apparaît.</small>
                  </label>
                    </>
                  )}
                  <button onClick={() => setEmulated((list) => list.filter((_, j) => j !== i))}>Retirer ce jeu</button>
                </div>
              )
            })}
          </>
        )
      case 'themes':
        return (
          <ThemesPanel
            activeId={activeTheme}
            gameBackdrop={gameBackdrop}
            onGameBackdrop={setGameBackdrop}
            onSelect={(t) => {
              setActiveTheme(t.id)
              setTheme(t.base)
            }}
          />
        )
      case 'display':
        return (
          <>
            <p className="settings-note">Les couleurs, le fond d’écran, le style du menu et le fond des jeux se règlent dans « Thèmes ».</p>
            <label className="check">
              <input type="checkbox" checked={fullscreen} onChange={(e) => setFullscreen(e.target.checked)} />
              Plein écran
            </label>
            <label className="check">
              <input type="checkbox" checked={autoStart} onChange={(e) => setAutoStart(e.target.checked)} />
              Lancer au démarrage de la session
            </label>
            {showAdvanced && (
            <div className="field-pair">
              <label className="field">
                <span>Nom de la fenêtre</span>
                <input value={appTitle} onChange={(e) => setAppTitle(e.target.value)} />
              </label>
              <label className="field">
                <span>Icône de la fenêtre</span>
                <div className="field-row">
                  <input value={appIcon} onChange={(e) => setAppIcon(e.target.value)} />
                  <button
                    onClick={async () => {
                      const file = await window.api.pickImage()
                      if (file) setAppIcon(file)
                    }}
                  >
                    Parcourir…
                  </button>
                </div>
                <small>Fichier png, jpg ou ico.</small>
              </label>
            </div>
            )}
          </>
        )
      case 'sound':
        return (
          <>
            <div className="field-pair">
              <label className="field">
                <span>Musique : {musicVolume} %</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={musicVolume}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setMusicVolume(v)
                    engine.configure({ music: v })
                  }}
                />
              </label>
              <label className="field">
                <span>Effets sonores : {sfxVolume} %</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={sfxVolume}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setSfxVolume(v)
                    engine.configure({ sfx: v })
                  }}
                  onPointerUp={() => engine.play('valider')}
                  onKeyUp={() => engine.play('valider')}
                />
              </label>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={muted}
                onChange={(e) => {
                  setMuted(e.target.checked)
                  engine.configure({ muted: e.target.checked })
                }}
              />
              Couper tous les sons
            </label>
            {showAdvanced && folderRow(
              'Dossier de tes propres sons',
              audioDir,
              setAudioDir,
              '« menu » est la musique de fond (aucune par défaut) ; deplacer, valider, retour, lancer et refuser remplacent les petits sons (mp3, ogg, wav…).'
            )}
          </>
        )
      case 'controllers':
        return (
          <label className="check">
            <input type="checkbox" checked={swapConfirm} onChange={(e) => setSwapConfirm(e.target.checked)} />
            Valider avec le bouton de droite de la manette
          </label>
        )
      case 'album':
        return (
          <>
            {folderRow('Dossier de l’album', albumDir, setAlbumDir)}
            {showAdvanced && (
            <label className="field">
              <span>Touche de capture</span>
              <input value={captureKey} onChange={(e) => setCaptureKey(e.target.value)} />
              <small>Pendant un jeu. Ex. F12, F9, CommandOrControl+Shift+S.</small>
            </label>
            )}
          </>
        )
      case 'news':
        return (
          <>
            <p className="settings-note">Les actualités des jeux s’affichent dans le menu, depuis un flux choisi pour toi.</p>
            {showAdvanced && (
              <label className="field">
                <span>Flux des actualités</span>
                <input value={newsFeedUrl} onChange={(e) => setNewsFeedUrl(e.target.value)} />
                <small>Adresse https d’un flux RSS ou Atom.</small>
              </label>
            )}
          </>
        )
      case 'backups':
        return (
          <>
            <h3>Parties de chaque joueur</h3>
            <p className="settings-note">
              Chaque profil a ses propres sauvegardes de jeu, comme sur la console : choisis ton profil dans « Qui joue ? », lance un jeu
              et tu retrouves ta partie. Un nouveau profil repart de zéro. Les parties déjà présentes vont au premier profil qui lance le
              jeu. Pour l’instant : Mario Kart World, Donkey Kong Bananza, Pokémon Pokopia et Zelda Ocarina of Time.
            </p>
            <h3>Sauvegarde des profils</h3>
            <p className="settings-note">
              Tes profils, ton temps de jeu et tes dernières parties sont sauvegardés automatiquement, au lancement et à la fermeture
              (les 30 dernières sont gardées). Restaurer une sauvegarde garde d’abord une copie de l’état actuel.
            </p>
            {backupNote && <p className="settings-note backup-note">{backupNote}</p>}
            <div className="field-row wrap">
              <button className="primary" onClick={() => void createBackup()}>
                Sauvegarder maintenant
              </button>
              <button onClick={() => void exportBackup()}>Exporter dans un fichier…</button>
              <button onClick={() => void importBackup()}>Importer un fichier…</button>
              <button onClick={() => void window.api.openBackupFolder()}>Ouvrir le dossier</button>
            </div>
            {backups.length === 0 && <p className="settings-note">Aucune sauvegarde pour l’instant.</p>}
            {backups.map((b) => (
              <div className="backup-row" key={b.name}>
                <div>
                  <div className="backup-date">{new Date(b.createdAt).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}</div>
                  <small>
                    {b.reason || 'sauvegarde'} · {b.profiles.join(', ')}
                  </small>
                </div>
                <button
                  className={confirmRestore === b.name ? 'primary' : ''}
                  onClick={() => (confirmRestore === b.name ? void restoreBackup(b.name) : setConfirmRestore(b.name))}
                >
                  {confirmRestore === b.name ? 'Confirmer' : 'Restaurer'}
                </button>
              </div>
            ))}
          </>
        )
      default:
        return (
          <>
            <label className="check">
              <input type="checkbox" checked={showAdvanced} onChange={(e) => setShowAdvanced(e.target.checked)} />
              Afficher les réglages avancés
            </label>
            <p className="settings-note">
              Pour les utilisateurs expérimentés : arguments des jeux, noms et icône de la fenêtre, touche de capture, sons personnalisés,
              flux d’actualités. Tu n’en as pas besoin pour jouer.
            </p>
            <div className="field-row wrap">
              <button onClick={() => void replayTour()}>Revoir la visite guidée</button>
            </div>
          </>
        )
    }
  })()

  return (
    <Screen
      title="Paramètres de la console"
      onBack={() => void leave()}
      hints={[{ key: 'A', label: 'Modifier' }]}
    >
      <div className="settings">
        <ul className="settings-nav">
          {CATEGORIES.map((c, i) => (
            <li key={c.id}>
              <button className={`settings-cat${i === cat ? ' focused' : ''}`} onClick={() => setCat(i)}>
                {c.label}
              </button>
            </li>
          ))}
        </ul>
        <div className="settings-pane dialog" data-native-input ref={paneRef}>
          <h2>{CATEGORIES[cat].label}</h2>
          {content}
        </div>
      </div>
    </Screen>
  )
}
