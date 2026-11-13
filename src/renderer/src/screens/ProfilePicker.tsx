import { useState } from 'react'
import type { Config, ProfileArt } from '../../../shared/types'
import { useMoveSound } from '../audio/useSound'
import Avatar from '../components/Avatar'
import Screen from '../components/Screen'
import { useInput } from '../hooks/useInput'

interface Props {
  config: Config
  art: Record<string, ProfileArt>
  onSelect: (id: string) => void
  onEdit: (id: string) => void
  onAdd: () => void
  onBack: () => void
}

/** « Qui joue ? » : le choix de l'utilisateur, avec un bouton pour en ajouter un. */
export default function ProfilePicker({ config, art, onSelect, onEdit, onAdd, onBack }: Props): JSX.Element {
  const { profiles } = config
  const [sel, setSel] = useState(Math.max(0, profiles.findIndex((p) => p.id === config.activeProfile)))
  const count = profiles.length + 1 // un mosaïque par profil, puis « Ajouter »
  useMoveSound(sel)

  useInput((action) => {
    if (action === 'back') onBack()
    else if (action === 'left') setSel((s) => Math.max(0, s - 1))
    else if (action === 'right') setSel((s) => Math.min(count - 1, s + 1))
    else if (action === 'confirm') {
      if (sel < profiles.length) onSelect(profiles[sel].id)
      else onAdd()
    } else if (action === 'option' && sel < profiles.length) onEdit(profiles[sel].id)
  })

  return (
    <Screen
      title="Qui joue ?"
      onBack={onBack}
      hints={[
        { key: 'A', label: 'Choisir' },
        { key: 'Y', label: 'Modifier' }
      ]}
    >
      <div className="users">
        {profiles.map((p, i) => (
          <button
            key={p.id}
            className={`user-tile${sel === i ? ' focused' : ''}${p.id === config.activeProfile ? ' active' : ''}`}
            onMouseEnter={() => setSel(i)}
            onClick={() => onSelect(p.id)}
            onContextMenu={(e) => {
              e.preventDefault()
              onEdit(p.id)
            }}
          >
            <span className="user-avatar">
              <Avatar profile={p} art={art[p.id]} />
            </span>
            <span className="user-name">{p.name}</span>
          </button>
        ))}
        <button
          className={`user-tile add${sel === profiles.length ? ' focused' : ''}`}
          onMouseEnter={() => setSel(profiles.length)}
          onClick={onAdd}
        >
          <span className="user-avatar">
            <span className="user-plus">+</span>
          </span>
          <span className="user-name">Ajouter un utilisateur</span>
        </button>
      </div>
    </Screen>
  )
}
