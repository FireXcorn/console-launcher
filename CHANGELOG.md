# Journal des versions

## 2.1.0

- **Ajouter son propre outil** : sur une « Cartouche vide » sans outil livré (Kirby, Yoshi…), A ouvre un guide qui mène à Paramètres → Ajouter des jeux, avec le titre du jeu déjà rempli. Nouveau guide illustré `docs/ajouter-un-outil.md`.

- **Jeux Pokémon** : 18 tuiles « Cartouche vide » (Game Boy, GBA, DS, 3DS, plus XD sur GameCube), chacune avec l'émulateur conseillé (mGBA, melonDS, Azahar, Dolphin), sa page officielle et ses arguments. Voir `docs/emulateurs-pokemon.md`.
- **Linux (Ubuntu), première étape** : lancement d'un émulateur sans PowerShell, arrêt du jeu, paquet AppImage (`npm run dist:linux`). Pas encore testé sur une vraie machine Linux.
- **Jeux livrés avec leur outil** : Mario Kart World, Donkey Kong Bananza, Pokémon Pokopia et Zelda Ocarina of Time se préparent depuis le lanceur à partir de ton propre fichier de jeu (système de « recettes », voir `docs/integrer-un-outil.md`). Plein écran possible par jeu.
- **Premier lancement guidé** : écran Bienvenue, tuiles « Cartouche vide » avec fenêtre « Il manque ta cartouche », puis visite guidée en 5 étapes (revoir : Paramètres → Avancé).
- **Sauvegardes de jeu par profil** : chaque profil retrouve ses propres sauvegardes, échangées automatiquement au lancement et à la sortie du jeu.
- **Sauvegarde des profils** : copie automatique, export, import et restauration.
- **Paramètres refaits** et simplifiés (les réglages techniques sont dans Avancé).
- **Manette** : l'écran Bienvenue et la visite se commandent à la manette ; le bouton Retour ne ferme plus la visite par erreur.
- Coin Wi-Fi/batterie : plus de pourcentage de batterie, cercle plus discret.

## 2.0.0

Première version publiée.
