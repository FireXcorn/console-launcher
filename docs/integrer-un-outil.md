# Intégrer toi-même un émulateur ou un outil de recompilation

[← Documentation](../README.md#documentation)

Le lanceur ne fournit aucun émulateur ni outil de recompilation : c'est **toi** qui les installes, puis tu apprends au lanceur à les démarrer. Cette page explique la méthode, pas à pas, avec des outils fictifs. Elle marche pour n'importe quel programme qui se lance depuis une fenêtre de commandes.

> Utilise des outils téléchargés depuis leur site officiel, avec des fichiers que tu possèdes légalement. Voir [ce qui est inclus et ce qui ne l'est pas](fichiers-de-jeu.md).

## L'idée

Le lanceur fait trois choses pour un jeu :

1. il démarre **un programme** avec **des arguments** ;
2. il surveille ce programme pour savoir **quand le jeu tourne** (et couvre l'écran de noir en attendant) ;
3. il rend la main quand le programme se termine.

Intégrer un outil, c'est donc trouver : **quel programme**, **quels arguments**, **comment savoir que le jeu tourne**.

## Étape 1 : faire marcher l'outil sans le lanceur

C'est l'étape la plus importante. Si ça ne marche pas à la main, ça ne marchera pas dans le lanceur.

1. Installe l'outil en suivant **sa** documentation (clés, firmware, dossiers de données éventuels : voir sa page officielle).
2. Ouvre une fenêtre de commandes **dans le dossier de l'outil**.
3. Lance ton jeu comme le ferait le lanceur :

   ```bash
   mon-emulateur.exe -f -g "D:\Jeux\mon-jeu.xyz"
   ```

   Les options (`-f`, `-g`…) changent d'un outil à l'autre : cherche « command line » ou « arguments » dans sa documentation, ou essaie `mon-emulateur.exe --help`.
4. Vérifie que le jeu démarre **et reste ouvert**. S'il se ferme tout seul, lis le journal de l'outil : c'est un problème de l'outil (réglages graphiques, fichiers manquants), pas du lanceur.

## Étape 2 : ajouter le jeu au lanceur

*Paramètres de la console → Ajouter des jeux → Ajouter un jeu sur émulateur…* (choisis l'émulateur, puis le fichier du jeu), puis vérifie la fiche :

| Champ | Ce que tu y mets |
|---|---|
| Titre du jeu | Le nom de la tuile. |
| Programme de l'émulateur | Le `.exe` de l'outil (pour un outil qui se lance seul, utilise **Ajouter un jeu PC…**). |
| Fichier du jeu | Ton fichier de jeu. |
| Arguments | Ceux de l'étape 1, avec `{game}` à la place du chemin du jeu : `-f -g {game}`. |

Lance la tuile. Trois issues possibles :

| Ce que tu vois | Que faire |
|---|---|
| Le jeu s'affiche, le lanceur se retire | C'est fini. |
| « Chargement » très long, puis le lanceur se retire seul | Passe à l'étape 3. |
| Retour immédiat au menu | Reprends l'étape 1 : l'outil s'arrête. |

## Étape 3 : dire au lanceur quand le jeu tourne

Par défaut, le lanceur reconnaît le jeu au **titre de la fenêtre** (un titre avec au moins trois `|`). Si ton outil affiche autre chose, il faut lui indiquer quoi chercher.

**Trouver le titre de la fenêtre de ton outil.** Lance ton jeu à la main, puis, dans PowerShell :

```bash
Get-Process | Where-Object { $_.MainWindowTitle } | Select-Object Name, MainWindowTitle
```

Repère la ligne de ton outil. Exemple : `Mon Emulateur v2 | Mon Jeu (64-bit) | GPU`. Ce titre contient le nom du jeu : c'est ce que le lanceur peut chercher.

**Régler `readyTitle`.** Dans `config.json` (lanceur fermé, fichier enregistré en UTF-8 **sans BOM** : voir [Configuration](configuration.md)), ajoute à l'entrée du jeu :

```json
{
  "title": "Mon Jeu",
  "emulatorExe": "C:\\Outils\\mon-emulateur.exe",
  "gameFile": "D:\\Jeux\\mon-jeu.xyz",
  "args": ["-f", "-g", "{game}"],
  "readyTitle": "\\|\\s*Mon Jeu",
  "settleMs": 8000
}
```

`readyTitle` est une expression régulière : le jeu est considéré lancé dès qu'elle correspond au titre, puis le lanceur attend `settleMs` millisecondes avant de se retirer. Les `\\` sont les `\` du JSON.

**Mieux : le journal.** Si ton outil écrit un journal, `readyLog` (chemin du fichier) et `readyPattern` (une phrase qui y apparaît quand le jeu tourne) sont plus fiables que le titre. Voir [Émulateurs](emulateurs.md#régler-la-détection-pour-un-émulateur-précis).

## Étape 4 : les questions de l'outil

Certains outils posent une question au démarrage (plein écran ? paramètres recommandés ?). Le lanceur répond « oui » à celles dont le texte correspond à `dialogPattern`. Si une question reste affichée, règle ce champ sur un mot de son texte.

## Cas d'un outil de recompilation ou de portage

Ces outils ne lancent pas le jeu : ils **fabriquent un programme PC** à partir de ta copie du jeu. Deux temps :

1. Utilise l'outil **une fois**, comme l'indique sa documentation. Il produit un dossier avec un `.exe`.
2. Ajoute ce dossier comme un [jeu natif](jeux-natifs.md) : le lanceur démarre le programme directement.

Si le programme refuse de démarrer, vérifie les arguments : un programme qui ne connaît pas une option s'arrête. Laisse le champ vide en cas de doute.

## Quand ça ne marche pas

- Journal du lanceur : `launcher.log`, dans son dossier de données. Les lignes « suivi du jeu » montrent le titre de fenêtre vu.
- Journal de l'outil : c'est lui qui dit pourquoi un jeu plante.
- [Dépannage](depannage.md).

## Partager ton réglage

Une fois que ça marche, tu peux partager **l'entrée JSON** (sans tes chemins personnels) pour aider d'autres utilisateurs du même outil, par exemple dans un ticket ou une discussion du dépôt. Ne partage jamais de fichiers de jeu, de clés ni de firmware.

## Jeux livrés avec leur outil (recettes)

Une version complète du lanceur peut contenir, à côté de l'application, un dossier `resources\tools\` (les outils : émulateur, recompilation…) et `resources\recipes\` (une recette `.json` par jeu). Dans *Paramètres → Ajouter des jeux*, la carte « Jeux livrés avec leur outil » liste ces jeux : tu choisis **ton** fichier de jeu, tu lances la préparation de l'outil si elle existe, et le jeu apparaît au menu après *Actualiser la bibliothèque*.

Les fichiers de jeu, clés et dumps ne sont jamais fournis. Chaque outil garde sa propre licence : garde son fichier de licence dans son dossier.

Une recette ressemble à ceci (aucun chemin absolu) :

```json
{
  "id": "mon-jeu",
  "title": "Mon Jeu",
  "tool": "mon-outil",
  "exe": "outil.exe",
  "args": ["-g", "{game}"],
  "needs": [{ "id": "game", "label": "Ton fichier du jeu", "kind": "file" }],
  "gameFileFrom": "game",
  "setup": { "exe": "preparer.exe", "note": "Texte d'aide affiché à l'utilisateur." },
  "doneFile": "fait.txt"
}
```

`base` : où vit le jeu prêt (`tool` par défaut, `out` = dossier créé par le lanceur, `need:<id>` = dossier indiqué par l'utilisateur). `needs` : ce que l'utilisateur fournit. `setup` : programme de préparation de l'outil : ouvert dans sa fenêtre, ou, avec `"mode": "cli"`, exécuté par le lanceur qui affiche sa progression (`{out}` = dossier du jeu, `{id}` = entrée de l'utilisateur). `doneFile` : fichier dont la présence prouve que la préparation est finie. Pour fabriquer la version complète, remplis `tools-src\` (ignoré par git) avec `scripts/prepare-tools.ps1` (il extrait les archives d'origine, sans aucun fichier de jeu), puis lance `npm run dist`.

`saves` (facultatif) : dossiers de sauvegarde du jeu, relatifs à son dossier ou avec `{appdata}` ; le lanceur les sépare par profil.
