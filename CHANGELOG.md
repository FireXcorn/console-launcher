# Journal des versions

## 2.4.0

- **Mini lecteur de musique** en haut de l'accueil : il apparaît dès que Spotify ou Apple Music joue (sous Linux : Spotify), grandit quand on le sélectionne, ouvre l'appli avec A ; précédent / pause / suivant avec L / Y / R ou au clavier.
- **Thèmes « Verre liquide » et « Verre liquide sombre ».**
- **Applis** : YouTube, Discord, Spotify, Apple Music, Firefox… Les sites s'ouvrent dans la fenêtre du lanceur ; retour avec le bouton « Retour au lanceur », F4 (ou Maj + F4) ou le bouton View de la manette.
- **Ajouter ses propres applis** : un site (`https://…`, ouvert dans le lanceur) ou un programme du PC, avec une image au choix ; Y retire une appli ajoutée.
- **Options d'un jeu** (+ ou Tab) : renommer, choisir une jaquette, extraire la sauvegarde, retirer le jeu.
- **Écran Pokémon** : Y ajoute des fichiers de jeu (ou glisser-déposer), + ouvre les options du jeu.
- **Pokémon Home** : les sauvegardes des émulateurs sont reconnues automatiquement ; copie de secours de la sauvegarde en quittant un jeu.
- **Jeu de mon PC** : jeux Steam et Epic Games détectés en plus du Microsoft Store / Xbox.
- **Ajout de jeux rétro** : titres corrigés, doublons et émulateur manquant signalés, copie sans figer la fenêtre.
- **Documentation** : README refait avec de nouvelles captures.

## 2.3.0

- **Ajouter un jeu, pas à pas** : nouvel assistant en trois cartes (« Jeux rétro », « Jeu de mon PC », « Jeu Switch 2 ») à l’accueil du premier lancement, dans Paramètres et dans l’écran Pokémon. Les jeux installés sur le PC (Microsoft Store et Xbox, Steam, Epic ; pas les outils ni les applications) se choisissent dans une liste ; chaque ajout est enregistré tout de suite. Un jeu PC sans jaquette prend automatiquement l’icône du programme (celle du bureau) comme tuile.
- **Paramètres** : catégories rangées par groupes, « Ajouter des jeux » en premier, liste compacte des jeux ajoutés, déplacement d’un réglage à l’autre à la manette.
- **Tuile « Pokémon »** : les jeux Pokémon ne sont plus des tuiles séparées. Une seule tuile « Pokémon » sur l'accueil ouvre un écran qui les range par console (3DS, DS, GBA, Game Boy), avec leurs jaquettes ; A lance le jeu ou ouvre le guide « Cartouche vide ».
- **Applis** : nouvel écran pour les petites applications libres livrées avec le lanceur.
- **Pokémon Home** : gestionnaire de Pokémon (PKVault) livré avec le lanceur sous Windows et Linux, rien à télécharger. Jaquette « Pokémon Home » dans l’écran Applis (fichier « Pokémon Home » dans le dossier des jaquettes), qui s’ouvre dans la fenêtre du lanceur ; l’écran Applis indique le dossier des sauvegardes 3DS d’Azahar à lui donner. PKHeX est retiré.
- **Yoshi and the Mysterious Book** ajouté (même émulateur que Mario Kart World).

## 2.2.0

- **Jeux Pokémon** : 30 tuiles « Cartouche vide » (une par version, de la plus récente à la plus ancienne, après les jeux Switch 2) : Game Boy, GBA, DS, 3DS, plus XD sur GameCube. Chacune a son émulateur conseillé (mGBA, melonDS, Azahar, Dolphin), sa page officielle et ses arguments. mGBA, melonDS et Azahar sont livrés avec le lanceur (Windows et Linux), préparés par `scripts/prepare-emulators.ps1`. Voir `docs/emulateurs-pokemon.md`.
- **Dossier des jeux** : un dossier `Jeux` (un sous-dossier par console) livré à côté du lanceur. Chaque fichier de jeu déposé dedans devient une tuile jouable avec l'émulateur livré ; les jeux Pokémon sont reconnus par leur nom de fichier.
- **Jaquettes et fonds livrés** avec le lanceur ; ceux que tu mets dans ton dossier de jaquettes restent prioritaires.
- **Ajouter son propre outil** : sur une « Cartouche vide » sans outil livré (Kirby, Yoshi…), A ouvre un guide qui mène à Paramètres → Ajouter des jeux, avec le titre du jeu déjà rempli. Nouveau guide illustré `docs/ajouter-un-outil.md`.
- **Souris** : la molette fait avancer d'une tuile par cran, et la sélection au survol ne s'emballe plus quand la rangée défile sous le curseur.
- **Linux (Ubuntu)** : lancement d'un émulateur sans PowerShell, arrêt du jeu, paquet AppImage (`npm run dist:linux`). Essayé dans une machine virtuelle seulement. Les jeux Switch 2 (programmes Windows) restent visibles mais portent la mention rouge « Indisponible sur Linux » sous leur jaquette ; A ouvre une petite fenêtre qui explique d'attendre une nouvelle version.

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
