# Jouer aux jeux Pokémon (Game Boy à Switch) avec des émulateurs

[← Documentation](../README.md#documentation)

Chaque génération de Pokémon se joue avec un émulateur libre. **mGBA, melonDS et Azahar sont livrés avec le lanceur** (versions Windows et Linux/AppImage) : il ne te manque que **ton** fichier de jeu. Pokémon XD et Pokémon Ranger ne sont plus proposés.

> Aucun jeu, clé ni firmware n'est fourni. Utilise uniquement des jeux que tu possèdes, copiés depuis ta propre console ou ta propre cartouche.

## Les tuiles Pokémon du menu

Le menu contient une tuile « Cartouche vide » par version (30 au total, de la plus récente à la plus ancienne). Sélectionne-la et appuie sur **A** : le guide t'amène dans Paramètres → Ajouter des jeux avec le titre et les bons arguments déjà remplis. Clique sur « Ajouter un jeu sur émulateur… » et choisis seulement **ta** ROM : l'émulateur est déjà choisi.

- **mGBA** : Rouge et Bleu (et Vert), Jaune, Or et Argent, Cristal, Rubis et Saphir, Rouge Feu et Vert Feuille, Émeraude.
- **melonDS** : Ranger, Diamant et Perle, Platine, HeartGold et SoulSilver, Noire et Blanche, Noire 2 et Blanche 2.
- **Azahar** : X et Y, Rubis Oméga et Saphir Alpha, Soleil et Lune, Ultra-Soleil et Ultra-Lune.
- **Dolphin** (GameCube) : XD, Le Souffle des Ténèbres.

Les jeux Switch et Switch 2 n'y figurent pas.

## Le dossier des jeux

Le lanceur crée un dossier **Jeux** (dans ton dossier personnel, avec un sous-dossier par console). Dépose-y tes fichiers de jeu (`.gb`, `.gbc`, `.gba`, `.nds`, `.3ds`) : au prochain démarrage, chacun devient une tuile jouable, avec l'émulateur livré. Les jeux Pokémon sont reconnus par leur nom de fichier (français ou anglais). Le bouton **Ouvrir le dossier des jeux** est dans Paramètres → Ajouter des jeux et dans le guide d'une « Cartouche vide ». Un jeu ajouté à la main avec le même titre garde la priorité.

## Fichiers de jeu

Utilise uniquement des fichiers copiés depuis **tes propres** cartouches et consoles. Ne télécharge pas de ROM sur des sites : ce sont des copies illégales, et ces fichiers sont une source courante de logiciels malveillants.

## Quel émulateur pour quel jeu

| Générations | Console d'origine | Émulateur | Fichier de jeu |
|---|---|---|---|
| 1 à 3 (Rouge/Bleu, Or/Argent, Rubis/Saphir…) | Game Boy, Game Boy Color, GBA | **mGBA** | `.gb`, `.gbc`, `.gba` |
| 4 et 5 (Diamant/Perle, Noir/Blanc…) | Nintendo DS | **melonDS** | `.nds` |
| 6 et 7 (X/Y, Soleil/Lune…) | 3DS et 2DS (même catalogue) | **Azahar** | `.3ds`, `.cci`, `.cxi` |
| 8 et 9 (Épée/Bouclier, Écarlate/Violet…) | Switch | Un émulateur Switch encore maintenu : les projets d'origine ont été arrêtés, des forks les continuent. Vérifie leur page avant de choisir. | `.nsp`, `.xci` (+ **tes** clés et firmware) |

Sur Ubuntu, chaque projet propose en général un **AppImage** (un seul fichier, à rendre exécutable) ou un **Flatpak**. Cherche sur sa page officielle, onglet **Releases**.

## Sous Linux (Ubuntu)

Le lanceur existe aussi pour Linux (`npm run dist:linux`, fichier AppImage). Sous Linux :

- les tuiles et le guide Pokémon fonctionnent comme sous Windows ; choisis le fichier **AppImage** de l'émulateur (pas le Flatpak) ;
- l'écran noir de lancement se retire au bout de quelques secondes, sans suivi de la fenêtre du jeu ;
- Arrêter le jeu depuis le lanceur arrête l'émulateur ; la manette Retour + Menu maintenus n'est pas encore gérée ;
- les jeux livrés avec leur outil (Mario Kart World, Zelda…) sont des programmes Windows : sous Linux, leur tuile porte la mention rouge « Indisponible sur Linux » et A explique d'attendre une nouvelle version.

## Pokémon Home : tes sauvegardes sont reconnues toutes seules

À chaque ouverture de Pokémon Home (écran **Applis**), le lanceur indique à PKVault où chercher :

| Console | Où sont les sauvegardes | Émulateur |
|---|---|---|
| Game Boy, Game Boy Color, GBA | à côté du jeu, dans `Jeux/<console>/` (fichier `.sav`) | mGBA |
| DS | à côté du jeu, dans `Jeux/Nintendo DS/` (`.sav`, `.dsv`) | melonDS |
| 3DS | dossier `sdmc` d'Azahar (`~/.local/share/azahar-emu/sdmc` sous Linux, `%APPDATA%\Azahar\sdmc` sous Windows) | Azahar |

Il suffit donc d'avoir lancé le jeu une fois et d'avoir sauvegardé dans le jeu (pas seulement un « état »). Tes propres chemins ajoutés dans les réglages de PKVault sont conservés.

**Récupérer le fichier de sauvegarde à la main** : ouvre le dossier des jeux (Paramètres → Ajouter des jeux → *Ouvrir le dossier des jeux*) et copie le `.sav` qui porte le nom de ton jeu. Pour la 3DS, c'est le fichier `main` dans `data/00000001` du jeu, sous `sdmc`.

## Rendre un AppImage exécutable (Ubuntu)

Clic droit sur le fichier → Propriétés → Permissions → « Autoriser l'exécution du fichier comme un programme ». Ou, dans un terminal :

```bash
chmod +x MonEmulateur.AppImage
```

Essaie-le d'abord à la main avec ton jeu. **S'il ne marche pas seul, il ne marchera pas dans le lanceur.**

## Les brancher dans le lanceur

1. Paramètres → **Ajouter des jeux** → **Ajouter un jeu sur émulateur…**
2. Choisis le programme de l'émulateur (l'AppImage), puis **ton** fichier de jeu.
3. Donne le titre du jeu (par exemple « Pokémon Émeraude »).

Un émulateur par console, un jeu par fiche. Les arguments habituels (réglages avancés) : `{game}` à la place du chemin du jeu. Pour le plein écran, regarde l'aide de l'émulateur (souvent `-f`).

## Si ça ne marche pas

- L'émulateur se ferme tout de suite : relance-le à la main dans un terminal pour lire le message d'erreur.
- DS, 3DS et Switch demandent parfois des fichiers de ta console (BIOS, clés). Le mode d'emploi de chaque émulateur l'explique.
- Le journal `launcher.log` et [Dépannage](depannage.md) aident à comprendre.
