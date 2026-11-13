# Installation

[← Retour à l'accueil de la documentation](../README.md#documentation)

## Systèmes pris en charge

| Système | État |
|---|---|
| Windows 10 / 11 | Pris en charge |
| Linux, macOS | Non testés. Le masquage de l'émulateur et les réponses automatiques aux fenêtres utilisent des outils Windows. |

## Télécharger une version prête à l'emploi

Si une version est publiée dans l'onglet **Releases** du dépôt GitHub : télécharge l'archive, décompresse-la où tu veux et lance `Console Launcher.exe`. Rien à installer.

## Construire depuis les sources

Il te faut [Node.js](https://nodejs.org) 20 ou plus récent et `git`.

```bash
git clone https://github.com/FireXcorn/console-launcher.git
cd console-launcher
npm install
npm run dist
```

`npm run dist` compile l'application puis produit un dossier prêt à l'emploi :

```
dist/win-unpacked/
└─ Console Launcher.exe      ← lance ce programme
```

Tu peux déplacer tout le dossier `win-unpacked` où tu veux (par exemple `C:\Programmes\Console Launcher`), puis créer un raccourci vers `Console Launcher.exe` sur le bureau.

## Lancer en mode développement

```bash
npm install
npm run dev
```

## Premier démarrage

Au premier lancement, un écran **Bienvenue** propose une visite guidée (flèches et bulles) : elle montre une tuile **« Cartouche vide »**, ton profil, les Paramètres, et comment quitter un jeu.

Les jeux livrés avec leur outil (Mario Kart World, Donkey Kong Bananza, Pokémon Pokopia, Zelda Ocarina of Time) sont déjà dans le menu avec la mention **« Cartouche vide »**. Sélectionne-en un et appuie sur **A** : une fenêtre te dit quoi apporter (ton propre fichier de jeu), te laisse le choisir, prépare le jeu et le rend jouable. Aucun jeu n'est fourni.

Tout se retrouve dans **Paramètres de la console → Ajouter des jeux** ; la visite se relance dans **Paramètres → Avancé → Revoir la visite guidée**.

- [Jeux PC et jeux recompilés](jeux-natifs.md) : un programme, ou un dossier entier ;
- [Jeux sur émulateur](emulateurs.md) : l'émulateur et le fichier du jeu.

En jeu, `Ctrl+Alt+Q` (ou `Retour` + `Menu` maintenus 2 secondes sur manette) ramène au menu.

## Démarrer avec la session

**Paramètres de la console → Écran → Lancer au démarrage de la session.** Le réglage ne fonctionne que sur l'application construite (`npm run dist`), pas en mode développement.

## Où sont mes réglages ?

Dans un fichier `config.json`, dans le dossier de données du lanceur (sous `%APPDATA%` sous Windows). Voir [Configuration](configuration.md). Le journal `launcher.log` se trouve au même endroit.

## Mettre à jour

Construis la nouvelle version, puis remplace le dossier de l'application. Tes réglages, profils et thèmes sont conservés : ils sont rangés à part, dans le dossier de données.
