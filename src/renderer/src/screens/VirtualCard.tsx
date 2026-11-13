import { useEffect, useRef, useState } from 'react'
import type { Config, Game } from '../../../shared/types'
import { useMoveSound } from '../audio/useSound'
import Screen from '../components/Screen'
import { useInput } from '../hooks/useInput'

interface Props {
  config: Config
  games: Game[]
  onToggleMissing: () => void
  onBack: () => void
}

/**
 * « Carte de jeu virtuelle » : la liste des cartouches. Un jeu installé est une cartouche insérée,
 * une exclusivité du catalogue est une cartouche vide. Une bascule masque ou affiche les vides.
 */
export default function VirtualCardScreen({ config, games, onToggleMissing, onBack }: Props): JSX.Element {
  const [sel, setSel] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)
  const rows = games.length + 1 // la bascule, puis un jeu par ligne
  useMoveSound(sel)

  useEffect(() => {
    listRef.current?.querySelector('.card-row.focused')?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  useInput((action) => {
    if (action === 'back') onBack()
    else if (action === 'up') setSel((s) => Math.max(0, s - 1))
    else if (action === 'down') setSel((s) => Math.min(rows - 1, s + 1))
    else if (action === 'confirm' && sel === 0) onToggleMissing()
  })

  const inserted = games.filter((g) => g.available).length
  const empty = games.length - inserted

  return (
    <Screen title="Carte de jeu virtuelle" onBack={onBack} hints={[{ key: 'A', label: 'Choisir' }]}>
      <ul className="card-list" ref={listRef}>
        <li>
          <button className={`card-row toggle${sel === 0 ? ' focused' : ''}`} onClick={onToggleMissing} onMouseEnter={() => setSel(0)}>
            <span>
              Afficher les cartouches vides
              <small>
                {inserted} insérée{inserted > 1 ? 's' : ''}
                {config.showMissingGames ? ` · ${empty} vide${empty > 1 ? 's' : ''}` : ''}
              </small>
            </span>
            <span className={`switch${config.showMissingGames ? ' on' : ''}`} role="switch" aria-checked={config.showMissingGames} />
          </button>
        </li>
        {games.map((g, i) => (
          <li key={g.id}>
            <div className={`card-row${sel === i + 1 ? ' focused' : ''}`} onMouseEnter={() => setSel(i + 1)}>
              <span className="card-art">{g.icon ? <img src={g.icon} alt="" draggable={false} /> : null}</span>
              <span className="card-title">{g.title}</span>
              <span className={`card-state${g.available ? ' in' : ''}`}>
                {g.available ? 'Cartouche insérée' : 'Cartouche vide'}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Screen>
  )
}
