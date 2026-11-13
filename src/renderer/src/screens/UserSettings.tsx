import { useState } from 'react'
import type { Config, Game, ProfileArt } from '../../../shared/types'
import { profilePlaytime } from '../../../shared/playtime'
import { useMoveSound } from '../audio/useSound'
import Avatar from '../components/Avatar'
import ConfirmDialog from '../components/ConfirmDialog'
import Screen from '../components/Screen'
import { useInput } from '../hooks/useInput'

export function formatPlaytime(seconds: number): string {
  if (seconds < 60) return seconds > 0 ? 'Moins d’une minute' : 'Jamais lancé'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`
}

interface Props {
  config: Config
  profileId: string
  games: Game[]
  art?: ProfileArt
  onEditIcon: () => void
  onEditName: () => void
  onActivity: () => void
  /** Supprime l'utilisateur (appelé après confirmation). */
  onDelete: () => void
  onBack: () => void
}

/**
 * « Paramètres de l'utilisateur », dans l'ordre de la console : Modifier l'icône, Modifier le pseudo,
 * Activité de jeu, Supprimer l'utilisateur (s'il en reste un autre).
 */
export default function UserSettingsScreen(props: Props): JSX.Element {
  const { config, profileId, games, art, onEditIcon, onEditName, onActivity, onDelete, onBack } = props
  const profile = config.profiles.find((p) => p.id === profileId) ?? config.profiles[0]
  const [sel, setSel] = useState(0)
  const [confirm, setConfirm] = useState(false)
  useMoveSound(sel)

  const total = games.reduce((sum, g) => sum + profilePlaytime(config, profile.id, g.id), 0)
  const rows = [
    { id: 'icon', label: 'Modifier l’icône', note: '', run: onEditIcon },
    { id: 'name', label: 'Modifier le pseudo', note: profile.name, run: onEditName },
    { id: 'activity', label: 'Activité de jeu', note: formatPlaytime(total), run: onActivity },
    ...(config.profiles.length > 1
      ? [{ id: 'delete', label: 'Supprimer l’utilisateur', note: '', run: () => setConfirm(true) }]
      : [])
  ]

  useInput((action) => {
    if (action === 'back') onBack()
    else if (action === 'up') setSel((s) => Math.max(0, s - 1))
    else if (action === 'down') setSel((s) => Math.min(rows.length - 1, s + 1))
    else if (action === 'confirm') rows[sel].run()
  })

  return (
    <Screen title="Paramètres de l’utilisateur" onBack={onBack} hints={[{ key: 'A', label: 'Choisir' }]}>
      <div className="usersettings">
        <div className="usersettings-who">
          <div className="mypage-avatar small">
            <Avatar profile={profile} art={art} />
          </div>
          <h2 className="mypage-name">{profile.name}</h2>
        </div>
        <ul className="card-list">
          {rows.map((r, i) => (
            <li key={r.id}>
              <button
                className={`card-row${sel === i ? ' focused' : ''}${r.id === 'delete' ? ' danger-row' : ''}`}
                onMouseEnter={() => setSel(i)}
                onClick={r.run}
              >
                <span className="card-title">{r.label}</span>
                {r.note && <span className="card-state">{r.note}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {confirm && (
        <ConfirmDialog
          title="Supprimer cet utilisateur ?"
          message={`« ${profile.name} » sera supprimé, avec son temps de jeu. Les jeux ne sont pas touchés.`}
          confirmLabel="Supprimer"
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false)
            onDelete()
          }}
        />
      )}
    </Screen>
  )
}
