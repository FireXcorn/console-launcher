# Publier le projet sur GitHub

[← Documentation](../README.md#documentation)

Ce guide explique comment mettre **le code et la documentation** du lanceur sur GitHub, puis comment publier une **version prête à l'emploi** que les gens peuvent télécharger sans rien compiler.

## Ce qui part sur GitHub, et ce qui reste chez toi

| Part sur GitHub | Reste sur ton PC (jamais publié) |
|---|---|
| Le code (`src/`), la documentation (`docs/`, `README.md`) | Tes jeux, tes émulateurs, tes outils de recompilation |
| La licence MIT, `package.json`, `.gitignore` | Tes clés et firmwares, tes fichiers de jeu |
| L'icône de l'application (`build/icon.ico`) | Tes réglages : `%APPDATA%\console-launcher\config.json` |
| Les captures d'écran de la documentation (`docs/images/`) | Tes images : jaquettes, grandes images de fond, personnages (`Images\…`) |
| | Le dossier `local/` (icône personnelle), les dossiers `dist*/`, `out/`, `node_modules/` |

Le fichier `.gitignore` empêche déjà d'envoyer par erreur `node_modules/`, `out/`, les dossiers `dist*/` et `local/`. Tes jeux et tes images ne sont pas dans le dossier du projet : ils ne peuvent donc pas partir.

> Ne publie jamais de fichier de jeu, de clé, de firmware ni d'outil de recompilation : c'est contraire au droit d'auteur. Voir [ce qui est inclus et ce qui ne l'est pas](fichiers-de-jeu.md).

## Avant de commencer

1. Un compte sur [github.com](https://github.com).
2. **GitHub Desktop** (le plus simple, [desktop.github.com](https://desktop.github.com)) **ou** `git` en ligne de commande. Connecte-toi à ton compte une fois.
3. Vérifie ces trois points dans le projet :
   - `README.md`, `CONTRIBUTING.md` et `docs/installation.md` contiennent l'adresse du dépôt (`https://github.com/FireXcorn/console-launcher`). Si ton compte ou le nom du dépôt est différent, remplace-la partout.
   - `LICENSE` contient ton nom (ligne `Copyright (c) 2026 …`).
   - Aucune image ou son protégé n'est dans `docs/images/`.

## Méthode 1 : GitHub Desktop (recommandée)

1. Ouvre GitHub Desktop → **File → Add local repository…** → choisis le dossier du projet.
2. Dans la colonne de gauche, tu vois tous les fichiers à envoyer. Contrôle la liste : pas de `node_modules`, pas de `dist`, pas de jeu.
3. En bas à gauche, écris un résumé (par exemple `Première version`) puis clique **Commit to main**.
4. Clique **Publish repository** (en haut) :
   - **Name** : `console-launcher` (ou le nom que tu veux) ;
   - **Description** : « Lanceur de jeux plein écran façon menu de console » ;
   - décoche **Keep this code private** si tu veux qu'il soit public.
5. Clique **Publish repository**. Le projet est en ligne.

Pour envoyer une modification plus tard : modifie les fichiers, écris un résumé, **Commit to main**, puis **Push origin**.

## Méthode 2 : ligne de commande

1. Sur github.com : **+ → New repository**. Nom : `console-launcher`. Ne coche ni README ni licence (ils existent déjà). Clique **Create repository**.
2. Dans une fenêtre de commandes, dans le dossier du projet :

   ```bash
   git config user.name "Ton Nom"
   git config user.email "ton-adresse@exemple.org"
   git add -A
   git commit -m "Première version"
   git branch -M main
   git remote add origin https://github.com/FireXcorn/console-launcher.git
   git push -u origin main
   ```

   (Pour garder ton adresse privée, utilise celle de GitHub : *Settings → Emails → Keep my email addresses private*, qui donne une adresse en `@users.noreply.github.com`.)
3. Si `git push` demande de t'identifier, connecte-toi avec le navigateur (Git Credential Manager) ou crée un *Personal access token* dans *Settings → Developer settings*. Ne le partage jamais et ne l'écris dans aucun fichier du projet.

## Soigner la page du dépôt

Sur la page GitHub du projet :

- **About** (roue dentée à droite) : une description et des sujets (*topics*) : `launcher`, `game-launcher`, `electron`, `react`, `typescript`.
- Le `README.md` s'affiche automatiquement : il présente le projet et mène à la documentation.
- Le menu **Issues** permet aux gens de signaler un problème. La page [Dépannage](depannage.md) dit quoi joindre.

## Publier une version téléchargeable (Releases)

Pour que les joueurs n'aient pas à compiler :

1. Construis la version standard :

   ```bash
   npm install
   npm run dist
   ```

   Le dossier `dist\win-unpacked\` contient `Console Launcher.exe` et ses fichiers.
2. Fais une archive **ZIP** de **tout** le dossier `win-unpacked` (clic droit → *Envoyer vers → Dossier compressé*). Nomme-la par exemple `Console-Launcher-0.1.0-windows.zip`.
3. Sur GitHub : onglet **Releases → Draft a new release**.
   - **Tag** : `v0.1.0` (*Create new tag*).
   - **Title** : `Console Launcher 0.1.0`.
   - Décris les nouveautés en quelques lignes.
   - Glisse le ZIP dans **Attach binaries**.
   - **Publish release**.
4. Le lien de téléchargement est maintenant sur la page du dépôt, à droite (*Releases*). La page [Installation](installation.md) l'explique aux utilisateurs.

L'archive ne contient que l'application : aucun jeu, aucun émulateur.

> Ta version personnelle (nom « Switch 2 », icône locale) est construite avec des options que la version publique n'a pas. Pour la publication, utilise toujours `npm run dist`.

## À savoir

- **Marques :** la documentation cite des noms de jeux, de consoles et d'émulateurs qui appartiennent à leurs propriétaires. Le `README.md` précise que le projet est indépendant. La liste intégrée des « cartouches vides » (`src/main/catalog.ts`) ne contient que des **titres** ; tu peux la vider ou la changer si tu préfères ne citer aucun jeu.
- **Images de jeux :** les jaquettes et les grandes images de fond que tu utilises chez toi ne doivent pas être ajoutées au dépôt.
- **Mises à jour :** chaque nouvelle version = un nouveau *commit* + un nouveau *tag* de Release (`v0.2.0`…).
- **Aide :** [Contribuer](../CONTRIBUTING.md) explique comment lancer et tester le projet pour d'autres développeurs.
