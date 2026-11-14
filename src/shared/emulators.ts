/**
 * Émulateurs conseillés pour les jeux Pokémon (Windows et Linux). Ils ne sont pas livrés avec le
 * lanceur : l'utilisateur les télécharge sur la page officielle de leur auteur (https uniquement).
 */
export interface EmulatorInfo {
  id: string
  name: string
  /** Consoles couvertes, pour le guide. */
  consoles: string
  /** Page officielle de téléchargement. */
  url: string
  /** Arguments proposés à l'ajout ; `{game}` est remplacé par le fichier du jeu. */
  args: string
  /** Titre de fenêtre qui annonce le jeu (le lanceur retire alors son écran noir) : n'importe lequel. */
  readyTitle: string
}

export const EMULATORS: Readonly<Record<string, EmulatorInfo>> = {
  mgba: {
    id: 'mgba',
    name: 'mGBA',
    consoles: 'Game Boy, Game Boy Color et Game Boy Advance',
    url: 'https://mgba.io/downloads.html',
    args: '-f {game}',
    readyTitle: '.'
  },
  melonds: {
    id: 'melonds',
    name: 'melonDS',
    consoles: 'Nintendo DS',
    url: 'https://melonds.kuribo64.net/downloads.php',
    args: '{game}',
    readyTitle: '.'
  },
  azahar: {
    id: 'azahar',
    name: 'Azahar',
    consoles: 'Nintendo 3DS et 2DS',
    url: 'https://azahar-emu.org/',
    args: '-f {game}',
    readyTitle: '.'
  },
  dolphin: {
    id: 'dolphin',
    name: 'Dolphin',
    consoles: 'GameCube',
    url: 'https://dolphin-emu.org/download/',
    args: '-b -e {game}',
    readyTitle: '.'
  }
}
