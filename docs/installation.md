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

Au premier lancement, la bibliothèque est vide : aucun dossier de jeux n'est choisi. Va dans **Paramètres de la console** :

- [Jeux natifs](jeux-natifs.md) → catégorie **Bibliothèque**
- [Jeux sur émulateur](emulateurs.md) → catégorie **Jeux sur émulateur**

## Démarrer avec la session

**Paramètres de la console → Écran → Lancer au démarrage de la session.** Le réglage ne fonctionne que sur l'application construite (`npm run dist`), pas en mode développement.

## Où sont mes réglages ?

Dans un fichier `config.json`, dans le dossier de données du lanceur (sous `%APPDATA%` sous Windows). Voir [Configuration](configuration.md). Le journal `launcher.log` se trouve au même endroit.

## Mettre à jour

Construis la nouvelle version, puis remplace le dossier de l'application. Tes réglages, profils et thèmes sont conservés : ils sont rangés à part, dans le dossier de données.
