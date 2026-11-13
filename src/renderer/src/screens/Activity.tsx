import { useState } from 'react'
import type { Config, Game } from '../../../shared/types'
import { clearProfilePlaytime, profilePlaytime } from '../../../shared/playtime'
import ConfirmDialog from '../components/ConfirmDialog'
import Screen from '../components/Screen'
import { useInput } from '../hooks/useInput'
import { formatPlaytime } from './UserSettings'

interface Props {
  config: Config
  profileId: string
  games: Game[]
  onChange: (patch: Partial<Config>) => void
  onBack: () => void
}

/** « Activité de jeu » : le temps joué par cet utilisateur, avec la possibilité de l'effacer. */
export default function ActivityScreen({ config, profileId, games, onChange, onBack }: Props): JSX.Element {
  const [confirm, setConfirm] = useState(false)
  const rows = games
    .map((g) => ({ game: g, seconds: profilePlaytime(config, profileId, g.id) }))
    .sort((a, b) => b.seconds - a.seconds || b.game.lastPlayed - a.game.lastPlayed)
  const total = rows.reduce((sum, r) => sum + r.seconds, 0)

  useInput((action) => {
    if (action === 'back') onBack()
    else if (action === 'confirm' || action === 'option') setConfirm(true)
  })

  return (
    <Screen
      title="Activité de jeu"
      onBack={onBack}
      hints={[{ key: 'A', label: 'Supprimer l’activité de jeu' }]}
    >
      <div className="activity">
        <div className="activity-total">
          <span>Temps de jeu total</span>
          <strong>{formatPlaytime(total)}</strong>
        </div>
        <ul className="activity-list">
          {rows.map(({ game, seconds }) => (
            <li key={game.id}>
              <span className="pg-title">{game.title}</span>
              <span className="pg-time">{formatPlaytime(seconds)}</span>
            </li>
          ))}
        </ul>
        <button className="btn danger" onClick={() => setConfirm(true)} disabled={total === 0}>
          Supprimer l’activité de jeu…
        </button>
      </div>

      {confirm && (
        <ConfirmDialog
          title="Supprimer l’activité de jeu ?"
          message="Le temps de jeu de cet utilisateur sera remis à zéro. Cette action est définitive."
          confirmLabel="Supprimer"
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            onChange({ playtime: clearProfilePlaytime(config, profileId) })
            setConfirm(false)
          }}
        />
      )}
    </Screen>
  )
}
