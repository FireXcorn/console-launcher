# Journal des versions

## 2.2.0

- **Jeux Pokémon** : 30 tuiles « Cartouche vide » (une par version, de la plus récente à la plus ancienne, après les jeux Switch 2) : Game Boy, GBA, DS, 3DS, plus XD sur GameCube. Chacune a son émulateur conseillé (mGBA, melonDS, Azahar, Dolphin), sa page officielle et ses arguments. mGBA, melonDS et Azahar sont livrés avec le lanceur (Windows et Linux), préparés par `scripts/prepare-emulators.ps1`. Voir `docs/emulateurs-pokemon.md`.
- **Dossier des jeux** : un dossier `Jeux` (un sous-dossier par console) livré à côté du lanceur. Chaque fichier de jeu déposé dedans devient une tuile jouable avec l'émulateur livré ; les jeux Pokémon sont reconnus par leur nom de fichier.
- **Jaquettes livrées** avec le lanceur ; celles que tu mets dans ton dossier de jaquettes restent prioritaires.
- **Ajouter son propre outil** : sur une « Cartouche vide » sans outil livré (Kirby, Yoshi…), A ouvre un guide qui mène à Paramètres → Ajouter des jeux, avec le titre du jeu déjà rempli. Nouveau guide illustré `docs/ajouter-un-outil.md`.
- **Souris** : la molette fait avancer d'une tuile par cran, et la sélection au survol ne s'emballe plus quand la rangée défile sous le curseur.
- **Linux (Ubuntu)** : lancement d'un émulateur sans PowerShell, arrêt du jeu, paquet AppImage (`npm run dist:linux`). Essayé dans une machine virtuelle seulement.

## 2.1.0

- **Jeux livrés avec leur outil** : Mario Kart World, Donkey Kong Bananza, Pokémon Pokopia et Zelda Ocarina of Time se préparent depuis le lanceur à partir de ton propre fichier de jeu (système de « recettes », voir `docs/integrer-un-outil.md`). Plein écran possible par jeu.
- **Premier lancement guidé** : écran Bienvenue, tuiles « Cartouche vide » avec fenêtre « Il manque ta cartouche », puis visite guidée en 5 étapes (revoir : Paramètres → Avancé).
- **Sauvegardes de jeu par profil** : chaque profil retrouve ses propres sauvegardes, échangées automatiquement au lancement et à la sortie du jeu.
- **Sauvegarde des profils** : copie automatique, export, import et restauration.
- **Paramètres refaits** et simplifiés (les réglages techniques sont dans Avancé).
- **Manette** : l'écran Bienvenue et la visite se commandent à la manette ; le bouton Retour ne ferme plus la visite par erreur.
- Coin Wi-Fi/batterie : plus de pourcentage de batterie, cercle plus discret.

## 2.0.0

Première version publiée.
