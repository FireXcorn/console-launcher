import { useEffect, useMemo, useRef, useState } from 'react'
import type { Game } from '../../../shared/types'
import Screen from '../components/Screen'
import { GameBackdrop, useBackdropArt } from '../components/Home'
import { useInput } from '../hooks/useInput'

const COLS = 6
const ORDER = ['Nintendo 3DS', 'Nintendo DS', 'Game Boy Advance', 'Game Boy et Game Boy Color']

interface Row {
  console: string
  first: boolean
  games: Game[]
}

/** Range les jeux par console (dans l'ordre voulu), puis en lignes de COLS jaquettes. */
export function pokemonRows(games: Game[]): Row[] {
  const rows: Row[] = []
  for (const name of ORDER) {
    const list = games.filter((g) => g.pokemonConsole === name)
    for (let i = 0; i < list.length; i += COLS) rows.push({ console: name, first: i === 0, games: list.slice(i, i + COLS) })
  }
  return rows
}

/**
 * Appli « Pokémon » : tous les jeux Pokémon rangés par console. Un jeu prêt se lance, une « cartouche vide »
 * ouvre son guide (comme sur l'accueil).
 */
export default function PokemonScreen({
  games,
  onPlay,
  backdrop,
  onAdd,
  onOptions,
  onBack
}: {
  games: Game[]
  backdrop: boolean
  /** Ouvre le choix des fichiers de jeu à ajouter. */
  onAdd: () => void
  /** Ouvre les options du jeu (jaquette perso…). */
  onOptions: (game: Game) => void
  onPlay: (game: Game) => void
  onBack: () => void
}): JSX.Element {
  const rows = useMemo(() => pokemonRows(games), [games])
  const [pos, setPos] = useState({ r: 0, c: 0 })
  const selected = useRef<HTMLButtonElement | null>(null)

  const current = rows[pos.r]?.games[pos.c]
  const art = useBackdropArt(current ?? null, backdrop, games)
  useEffect(() => {
    selected.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [pos])

  const move = (dr: number, dc: number): void =>
    setPos((p) => {
      const r = Math.min(Math.max(p.r + dr, 0), rows.length - 1)
      const c = Math.min(Math.max(p.c + dc, 0), (rows[r]?.games.length ?? 1) - 1)
      return { r, c }
    })

  useInput((action) => {
    if (action === 'back') onBack()
    else if (action === 'menu' && current) onOptions(current)
    else if (action === 'option') onAdd()
    else if (action === 'left') move(0, -1)
    else if (action === 'right') move(0, 1)
    else if (action === 'up') move(-1, 0)
    else if (action === 'down') move(1, 0)
    else if (action === 'confirm' && current) onPlay(current)
  })

  return (
    <Screen
      title="Pokémon"
      onBack={onBack}
      backdrop={<GameBackdrop art={art} active />}
      hints={[
        { key: 'A', label: 'Jouer' },
        { key: '+', label: 'Options du jeu' },
        { key: 'Y', label: 'Ajouter mes jeux' }
      ]}
    >
      <div className={`pokemon${art ? ' has-art' : ''}`}>
        <div className="pokemon-add">
          <button className="primary" onClick={onAdd}>
            Ajouter mes jeux
          </button>
          <span>Choisis tes fichiers (.gb, .gbc, .gba, .nds, .3ds) ou glisse-les sur cette fenêtre : le lanceur les range tout seul.</span>
        </div>
        {rows.length === 0 && <p className="settings-note">Aucun jeu Pokémon pour l’instant.</p>}
        {rows.map((row, r) => (
          <section key={`${row.console}-${r}`}>
            {row.first && <h2 className="pokemon-console">{row.console}</h2>}
            <div className="pokemon-row">
              {row.games.map((game, c) => {
                const focused = pos.r === r && pos.c === c
                return (
                  <button
                    key={game.id}
                    ref={focused ? selected : undefined}
                    className={`pokemon-game${focused ? ' focused' : ''}${game.available ? '' : ' empty'}`}
                    onMouseEnter={() => setPos({ r, c })}
                    onClick={() => onPlay(game)}
                    aria-label={game.title}
                  >
                    {game.icon ? <img src={game.icon} alt="" draggable={false} /> : <span className="pokemon-fallback">{game.title.replace('Pokémon ', '')}</span>}
                    {!game.available && <span className="pokemon-badge">Cartouche vide</span>}
                  </button>
                )
              })}
            </div>
          </section>
        ))}
        {current && (
          <p className="pokemon-title">
            {current.title}
            <small>{current.pokemonConsole}</small>
          </p>
        )}
      </div>
    </Screen>
  )
}
