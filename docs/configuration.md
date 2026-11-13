# Référence de `config.json`

[← Documentation](../README.md#documentation)

Presque tout se règle dans l'application (*Paramètres de la console*). Ce fichier sert aux réglages avancés et aux sauvegardes.

- **Emplacement** : dans le dossier de données du lanceur, sous `%APPDATA%`.
- **Avant de le modifier à la main, ferme le lanceur** : il réécrit le fichier à chaque changement.
- Une clé absente reprend sa valeur par défaut ; un fichier illisible n'est jamais écrasé en silence : il est gardé à côté (`config.json.casse-…`) et la dernière copie de secours (`config.json.bak`) est reprise si elle est valide. Le caractère invisible (BOM) que certains éditeurs ajoutent est accepté.

## Bibliothèque

| Clé | Type | Rôle |
|---|---|---|
| `gamesDir` | texte | Dossier des jeux natifs (lui-même et ses sous-dossiers directs). |
| `launchExe` | texte | Programme cherché dans chaque dossier de jeu, relatif à ce dossier. Vide par défaut. |
| `launchArgs` | liste de textes | Arguments ; `{dir}` = dossier du jeu. |
| `coversDir` | texte | Dossier de jaquettes nommées d'après le titre du jeu. |
| `showMissingGames` | oui/non | Affiche aussi des tuiles « Cartouche vide » pour des jeux non installés. |
| `overrides` | objet | Titres et images choisis par jeu : `{ "<id du jeu>": { "title": "…", "icon": "C:\\…" } }`. |

## Jeux ajoutés à la main (`emulated`)

La liste que remplit *Paramètres → Ajouter des jeux* : jeux sur émulateur, mais aussi jeux PC ou recompilés (sans `gameFile`). Liste d'entrées :

| Clé | Type | Rôle |
|---|---|---|
| `title` | texte | Nom affiché. |
| `emulatorExe` | texte | Programme de l'émulateur. |
| `gameFile` | texte | Fichier du jeu ; remplace `{game}` dans les arguments. Vide pour un jeu PC ou recompilé, lancé seul. |
| `args` | liste de textes | Arguments de l'émulateur. |
| `readyTitle` | texte | Expression régulière sur le titre de la fenêtre : le jeu tourne. Vide : titre à plusieurs `\|`. |
| `readyLog` | texte (facultatif) | Journal de l'émulateur à surveiller. |
| `readyPattern` | texte (facultatif) | Expression qui, en apparaissant dans ce journal, prouve que le jeu tourne. |
| `settleMs` | nombre (facultatif) | Pause avant de retirer l'écran noir (5000 par défaut). |
| `dialogPattern` | texte (facultatif) | Les questions de l'émulateur dont le texte correspond reçoivent « oui ». |
| `borderless` | `true` / `false` (facultatif) | Force la fenêtre du jeu en plein écran sans bordure (utile pour un jeu recompilé qui s'ouvre en petite fenêtre). |

Voir [Émulateurs](emulateurs.md).

## Apparence et fenêtre

| Clé | Type | Rôle |
|---|---|---|
| `activeTheme` | texte | Identifiant du thème actif (`clair`, `sombre`, `minuit`, `sakura`, `foret`, ou un dossier de `themes\`). |
| `theme` | `light` / `dark` | Jeu de couleurs du thème actif (tenu à jour automatiquement). |
| `fullscreen` | oui/non | Plein écran. |
| `autoStart` | oui/non | Lance le lanceur à l'ouverture de session (application construite uniquement). |
| `onboarded` | oui/non | L'assistant du premier lancement a été vu. Mettre `false` le fait réapparaître (s'il n'y a aucun jeu). |
| `gameBackdrop` | oui/non | Fond du jeu sélectionné : sa grande image sur tout l'écran derrière le menu (oui par défaut ; un jeu sans grande image n'a pas de fond). |
| `backdropsDir` | texte | Dossier des grandes images de fond (une image par jeu, nommée comme lui). |
| `appTitle` | texte | Titre de la fenêtre. |
| `appIcon` | texte | Image (png, jpg ou ico) servant d'icône de fenêtre. |

## Utilisateurs

| Clé | Type | Rôle |
|---|---|---|
| `profiles` | liste | Les utilisateurs : `id`, `name`, `color`, `background`, `avatar`, `image`. |
| `activeProfile` | texte | Identifiant du profil en cours. |
| `charactersDir` | texte | Dossier de personnages (un sous-dossier = une série). |
| `playtime` | objet | Secondes cumulées, clé `<profil>\|<jeu>`. |
| `lastPlayed` | objet | Dernier lancement de chaque jeu. |

## Manette, son, album, actualités

| Clé | Type | Rôle |
|---|---|---|
| `swapConfirm` | oui/non | Inverse valider et retour (A/B). |
| `sfxVolume` | 0 à 100 | Volume des effets. |
| `musicVolume` | 0 à 100 | Volume de la musique. |
| `muted` | oui/non | Coupe tous les sons. |
| `audioDir` | texte | Dossier de sons de remplacement. |
| `albumDir` | texte | Dossier des captures. |
| `captureKey` | texte | Raccourci de capture pendant un jeu (format Electron, ex. `F12`). |
| `newsFeedUrl` | texte | Adresse https d'un flux RSS ou Atom. |

## Exemple minimal

```json
{
  "gamesDir": "D:\\Mes jeux",
  "launchExe": "jeu.exe",
  "launchArgs": [],
  "emulated": [
    {
      "title": "Mon jeu",
      "emulatorExe": "C:\\Emu\\emulateur.exe",
      "gameFile": "D:\\Jeux\\mon-jeu.xyz",
      "args": ["-f", "-g", "{game}"],
      "readyTitle": ""
    }
  ]
}
```
