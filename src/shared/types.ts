import type { Theme } from './theme'

export interface Game {
  /** Identifiant stable : chemin du dossier en minuscules. */
  id: string
  title: string
  dir: string
  /** Exécutable à lancer, relatif à `dir`. */
  exe: string
  args: string[]
  /** Image sous forme d'URL `data:`, ou null si tuile générée. */
  icon: string | null
  lastPlayed: number
  /** Faux pour une exclusivité du catalogue : affichée « cartouche non insérée », non lançable. */
  available: boolean
  /** Vrai pour un jeu lancé par un émulateur. */
  emulated?: boolean
  /** Titre d'origine de l'entrée dans « jeux sur émulateur » (le titre affiché peut être renommé). */
  sourceTitle?: string
  /** Jeu livré avec son outil, pas encore prêt : « cartouche vide » dont l'utilisateur peut ajouter le fichier. */
  recipeId?: string
}

/** Un jeu trouvé dans un dossier par l'import : son titre et son programme. */
export interface ProgramCandidate {
  title: string
  exe: string
}

export interface GameOverride {
  title?: string
  /** Chemin absolu d'une image choisie par l'utilisateur. */
  icon?: string
  /** Chemin absolu d'une grande image de fond (affichée derrière le menu quand le jeu est sélectionné). */
  backdrop?: string
}

export interface Profile {
  id: string
  name: string
  /** Couleur de fond de l'avatar (#rrggbb) ; sert aussi de repli pour un arrière-plan à motif. */
  color: string
  /**
   * Arrière-plan de l'avatar : `c:#rrggbb` (uni), `g:<nom>` (dégradé) ou `p:<nom>` (motif).
   * Vide : on utilise `color`.
   */
  background: string
  /**
   * Personnage : identifiant d'une créature fournie avec le lanceur, ou `file:<chemin relatif>` d'une
   * image du dossier de personnages de l'utilisateur ; vide = silhouette.
   */
  avatar: string
  /** Chemin d'une image personnelle ; elle remplace le personnage. Vide = pas d'image. */
  image: string
}

/** Jeu qui se lance par un émulateur : le lanceur démarre l'émulateur avec le fichier du jeu. */
export interface EmulatedGame {
  title: string
  /** Programme de l'émulateur. */
  emulatorExe: string
  /** Fichier du jeu donné à l'émulateur. */
  gameFile: string
  /** Arguments de l'émulateur ; `{game}` est remplacé par le fichier du jeu. */
  args: string[]
  /**
   * Expression régulière sur le titre de la fenêtre de l'émulateur : dès qu'elle correspond, le jeu
   * tourne et l'écran noir du lanceur se retire. Vide : le titre à plusieurs « | » des émulateurs
   * de cette famille.
   */
  readyTitle: string
  /**
   * Facultatif, à écrire dans le fichier de configuration : journal de l'émulateur et expression qui,
   * en apparaissant dans ses nouvelles lignes, prouve que le jeu tourne. Plus fiable que le titre.
   */
  readyLog?: string
  readyPattern?: string
  /** Pause (ms) entre ce signal et le retrait de l'écran noir. Défaut : 5000. */
  settleMs?: number
  /**
   * Expression sur le texte des questions de l'émulateur à qui répondre « oui » automatiquement.
   * Défaut : paramètres recommandés, plein écran.
   */
  dialogPattern?: string
  /** Force la fenêtre du jeu en plein écran sans bordure (jeux recompilés dont la fenêtre est petite). */
  borderless?: boolean
}

/** Ce qu'une recette demande à l'utilisateur (son fichier ou dossier de jeu). */
export interface RecipeNeed {
  id: string
  label: string
  kind: 'file' | 'folder'
  hint?: string
  optional?: boolean
}

export type RecipeState = 'no-tool' | 'needs-input' | 'needs-setup' | 'ready'

/** État d'un jeu « à préparer » vu par l'interface. */
export interface RecipeInfo {
  id: string
  title: string
  state: RecipeState
  needs: RecipeNeed[]
  inputs: Record<string, string>
  note: string
  /** Ce que l'utilisateur doit apporter, en une phrase (fenêtre « Il manque ta cartouche »). */
  guide: string
  hasSetup: boolean
  /** Préparation faite par le lanceur lui-même (avec progression), plutôt que dans la fenêtre de l'outil. */
  cli: boolean
  /** Préparation en cours. */
  running?: boolean
  /** Dernière ligne de progression de la préparation. */
  progress?: string
}

/** Une sauvegarde des joueurs, telle que la liste l'affiche. */
export interface BackupInfo {
  name: string
  createdAt: number
  reason: string
  /** Noms des profils qu'elle contient. */
  profiles: string[]
}

export interface Config {
  /** Dossier scanné : lui-même et ses sous-dossiers directs. */
  gamesDir: string
  /** Exécutable recherché dans chaque dossier de jeu (relatif). */
  launchExe: string
  /** Arguments ; `{dir}` est remplacé par le dossier du jeu. */
  launchArgs: string[]
  /** Titre de la fenêtre du lanceur. */
  appTitle: string
  /** Image (png, jpg ou ico) utilisée comme icône de la fenêtre du lanceur ; vide = icône par défaut. */
  appIcon: string
  theme: 'light' | 'dark'
  fullscreen: boolean
  /** Identifiant du thème actif (fourni avec le lanceur, ou dossier de `themes/`). */
  activeTheme: string
  /** Lancer le lanceur à l'ouverture de session (Windows, macOS, Linux). */
  autoStart: boolean
  /** L'assistant du premier lancement a été vu (ou n'est pas nécessaire). */
  onboarded: boolean
  /** Fond animé : la jaquette du jeu sélectionné s'étire en bandes obliques derrière le menu. */
  gameBackdrop: boolean
  /** Dossier des grandes images de fond : une image par jeu, nommée comme le jeu. */
  backdropsDir: string
  /** Inverse valider/retour sur la manette (disposition Nintendo). */
  swapConfirm: boolean
  /** Dossier de l'album : les captures y sont enregistrées et affichées. */
  albumDir: string
  /** Raccourci global de capture pendant un jeu (format Electron, ex. F12). */
  captureKey: string
  /** Flux RSS ou Atom (https) des actualités. */
  newsFeedUrl: string
  /** Dossier où l'utilisateur dépose ses images de personnages (un sous-dossier = une série). */
  charactersDir: string
  /** Les profils d'utilisateur (au moins un). */
  profiles: Profile[]
  /** Identifiant du profil en cours d'utilisation. */
  activeProfile: string
  /** Jeux lancés par un émulateur (Mario Kart World, etc.). */
  emulated: EmulatedGame[]
  /** Affiche aussi les exclusivités Switch 2 que l'on n'a pas installées. */
  showMissingGames: boolean
  /** Dossier où l'utilisateur dépose des jaquettes nommées d'après le titre du jeu. */
  coversDir: string
  /** Dossier de musique et de sons de remplacement (menu, valider, retour…). */
  audioDir: string
  /** 0 à 100. */
  sfxVolume: number
  /** 0 à 100. */
  musicVolume: number
  muted: boolean
  /**
   * Temps de jeu cumulé en secondes : clé `<profil>|<jeu>` (voir `shared/playtime.ts`). Une clé sans
   * `|` est l'ancien décompte commun, attribué au premier profil.
   */
  playtime: Record<string, number>
  overrides: Record<string, GameOverride>
  lastPlayed: Record<string, number>
  /** Fichiers et dossiers donnés par l'utilisateur pour préparer chaque jeu à recette (recette, puis entrée, puis chemin). */
  recipeInputs: Record<string, Record<string, string>>
  /** Affiche les réglages avancés dans les Paramètres (arguments, noms de fenêtre, etc.). */
  showAdvanced: boolean
  /** Vrai une fois la visite guidée du premier lancement terminée ou passée. */
  tourDone: boolean
}

export type GameState =
  | { status: 'idle' }
  | { status: 'running'; id: string }
  | { status: 'error'; id: string; message: string }

export interface AlbumItem {
  path: string
  name: string
  /** Date de modification (ms). */
  modified: number
}

export interface NewsItem {
  title: string
  summary: string
  /** Toujours une adresse https. */
  link: string
  /** ms depuis l'époque ; 0 si inconnue. */
  date: number
}

export interface NewsResult {
  items: NewsItem[]
  fetchedAt: number
  /** Vrai si l'affichage vient du cache faute de connexion. */
  stale: boolean
  error?: string
}

export interface NetworkInfo {
  /** Nom du réseau Wi-Fi, ou null (câble, hors ligne, pas de Wi-Fi). */
  ssid: string | null
  /** Qualité du signal en pourcentage (0–100), ou null si inconnue. */
  signal: number | null
}

export type PowerAction = 'sleep' | 'restart' | 'shutdown'

/** Une image du dossier de personnages de l'utilisateur. */
export interface CharacterItem {
  /** Valeur à mettre dans `Profile.avatar` : `file:<chemin relatif>`. */
  id: string
  name: string
  /** Miniature (URL `data:`). */
  thumb: string
}

/** Un sous-dossier du dossier de personnages = une série. */
export interface CharacterSeries {
  name: string
  items: CharacterItem[]
}

/** Images à dessiner pour l'avatar d'un profil. */
export interface ProfileArt {
  /** Image personnelle : remplit tout le rond. */
  image?: string
  /** Image de personnage du dossier de l'utilisateur : posée sur l'arrière-plan. */
  character?: string
}

export interface Api {
  getConfig(): Promise<Config>
  setConfig(patch: Partial<Config>): Promise<Config>
  scan(): Promise<Game[]>
  launch(id: string): Promise<void>
  onGameState(cb: (state: GameState) => void): () => void
  pickFolder(): Promise<string | null>
  pickImage(): Promise<string | null>
  /** Choisit un fichier quelconque (programme, fichier de jeu…). */
  pickFile(): Promise<string | null>
  toggleFullscreen(): Promise<void>
  /** Ajoute une ligne au journal de l'application. */
  log(message: string): Promise<void>
  quit(): Promise<void>

  listAlbum(): Promise<AlbumItem[]>
  albumThumb(path: string): Promise<string | null>
  albumImage(path: string): Promise<string | null>
  /** Envoie la capture à la corbeille. */
  deleteAlbumItem(path: string): Promise<boolean>
  /** Ouvre le dossier de l'album dans l'Explorateur (il est créé s'il manque). */
  openAlbumFolder(): Promise<void>
  fetchNews(force?: boolean): Promise<NewsResult>
  /** Ouvre une adresse https ou un réglage Windows autorisé. */
  openExternal(url: string): Promise<boolean>
  networkInfo(): Promise<NetworkInfo>
  /** Jeux trouvés dans un dossier (un programme par sous-dossier). */
  findPrograms(dir: string): Promise<ProgramCandidate[]>
  /** Arrête le jeu en cours et revient au menu. */
  stopGame(): Promise<void>
  /** Jeux livrés avec leur outil (recettes) et leur état. */
  listRecipes(): Promise<RecipeInfo[]>
  /** Enregistre un fichier ou dossier donné pour une recette ; renvoie la liste mise à jour. */
  setRecipeInput(id: string, need: string, path: string): Promise<RecipeInfo[]>
  /** Ouvre l'outil de préparation du jeu. */
  /** Sauvegardes des joueurs (profils, temps de jeu), de la plus récente à la plus ancienne. */
  listBackups(): Promise<BackupInfo[]>
  /** Crée une sauvegarde maintenant. */
  createBackup(): Promise<BackupInfo[]>
  /** Restaure une sauvegarde (une copie de l'état actuel est faite avant) ; renvoie faux si elle est illisible. */
  restoreBackup(name: string): Promise<boolean>
  /** Enregistre la sauvegarde du jour dans un fichier choisi ; renvoie le chemin, ou null si annulé. */
  exportBackup(): Promise<string | null>
  /** Restaure depuis un fichier choisi ; renvoie faux s'il est annulé ou illisible. */
  importBackup(): Promise<boolean>
  /** Ouvre le dossier des sauvegardes. */
  openBackupFolder(): Promise<void>
  runRecipeSetup(id: string): Promise<boolean>
  /** Interrompt une préparation en cours. */
  cancelRecipeSetup(id: string): Promise<boolean>
  /** Grande image de fond d'un jeu (URL data:), ou null s'il n'en a pas. */
  gameBackdrop(id: string, title: string): Promise<string | null>
  power(action: PowerAction): Promise<void>
  /** Images des profils, par identifiant de profil (seulement celles qui existent). */
  profileImages(): Promise<Record<string, ProfileArt>>
  /** Les personnages que l'utilisateur a déposés dans son dossier, rangés par série. */
  listCharacters(): Promise<CharacterSeries[]>
  /** Aperçu d'une image que l'utilisateur vient de choisir (fichier png, jpg ou webp). */
  previewImage(path: string): Promise<string | null>
  /** Octets du fichier audio de remplacement (menu, valider…), ou null s'il n'existe pas. */
  customAudio(name: string): Promise<Uint8Array | null>
  /** Thèmes de l'utilisateur (dossiers de `themes/`) ; les thèmes fournis sont dans `shared/theme.ts`. */
  listThemes(): Promise<Theme[]>
  /** Fond d'écran d'un thème enregistré (image réduite pour l'écran), ou null. */
  themeWallpaper(id: string): Promise<string | null>
  /** Aperçu plein écran d'une image que l'utilisateur vient de choisir comme fond. */
  previewWallpaper(path: string): Promise<string | null>
  /** Enregistre un thème (copie le fond choisi dans son dossier) ; renvoie le thème tel qu'enregistré. */
  saveTheme(theme: Theme, wallpaperSource?: string): Promise<Theme>
  /** Importe un dossier de thème (theme.json, fond, sons) ; null s'il n'en contient pas. */
  importTheme(folder: string): Promise<Theme | null>
  deleteTheme(id: string): Promise<boolean>
  openThemesFolder(): Promise<void>
}
