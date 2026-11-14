# Jouer aux jeux Pokémon (Game Boy à Switch) avec des émulateurs

[← Documentation](../README.md#documentation)

Chaque génération de Pokémon se joue avec un émulateur libre, qui existe aussi pour **Linux (Ubuntu)**. Le lanceur ne les fournit pas : tu les télécharges sur la page **officielle** de leur auteur, puis tu les branches comme dans [Ajouter ton propre outil](ajouter-un-outil.md).

> Aucun jeu, clé ni firmware n'est fourni. Utilise uniquement des jeux que tu possèdes, copiés depuis ta propre console ou ta propre cartouche.

## Les tuiles Pokémon du menu

Le menu contient une tuile « Cartouche vide » pour chaque jeu ci-dessous. Sélectionne-la et appuie sur **A** : le guide te dit quel émulateur prendre, ouvre sa page officielle, puis t'amène dans Paramètres → Ajouter des jeux avec le titre et les bons arguments déjà remplis. Il ne reste qu'à choisir le programme de l'émulateur et **ta** ROM.

- **mGBA** : Rouge et Bleu (et Vert), Jaune, Or et Argent, Cristal, Rubis et Saphir, Rouge Feu et Vert Feuille, Émeraude.
- **melonDS** : Ranger, Diamant et Perle, Platine, HeartGold et SoulSilver, Noire et Blanche, Noire 2 et Blanche 2.
- **Azahar** : X et Y, Rubis Oméga et Saphir Alpha, Soleil et Lune, Ultra-Soleil et Ultra-Lune.
- **Dolphin** (GameCube) : XD, Le Souffle des Ténèbres.

Les jeux Switch et Switch 2 n'y figurent pas.

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
- les jeux livrés avec leur outil (Mario Kart World, Zelda…) restent réservés à Windows.

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
