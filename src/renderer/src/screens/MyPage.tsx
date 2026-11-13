import { useState } from 'react'
import type { Profile, ProfileArt } from '../../../shared/types'
import { useMoveSound } from '../audio/useSound'
import Avatar from '../components/Avatar'
import Screen from '../components/Screen'
import { useInput } from '../hooks/useInput'

interface Props {
  profile: Profile
  art?: ProfileArt
  onSettings: () => void
  onUsers: () => void
  onBack: () => void
}

/** « Ma page » : le point d'entrée du profil, comme la page utilisateur de la console. */
export default function MyPageScreen({ profile, art, onSettings, onUsers, onBack }: Props): JSX.Element {
  const [sel, setSel] = useState(0)
  useMoveSound(sel)
  const rows = [
    { label: 'Paramètres de l’utilisateur', run: onSettings },
    { label: 'Changer d’utilisateur', run: onUsers }
  ]

  useInput((action) => {
    if (action === 'back') onBack()
    else if (action === 'up') setSel((s) => Math.max(0, s - 1))
    else if (action === 'down') setSel((s) => Math.min(rows.length - 1, s + 1))
    else if (action === 'confirm') rows[sel].run()
  })

  return (
    <Screen title="Ma page" onBack={onBack} hints={[{ key: 'A', label: 'Choisir' }]}>
      <div className="mypage">
        <div className="mypage-avatar">
          <Avatar profile={profile} art={art} />
        </div>
        <h2 className="mypage-name">{profile.name}</h2>
        <ul className="mypage-list">
          {rows.map((r, i) => (
            <li key={r.label}>
              <button className={`card-row${sel === i ? ' focused' : ''}`} onMouseEnter={() => setSel(i)} onClick={r.run}>
                <span className="card-title">{r.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Screen>
  )
}
