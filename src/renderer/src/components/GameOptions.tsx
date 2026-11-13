import { useRef, useState } from 'react'
import type { Config, Game } from '../../../shared/types'
import { useMoveSound } from '../audio/useSound'
import { useInput } from '../hooks/useInput'
import ConfirmDialog from './ConfirmDialog'

interface Props {
  game: Game
  config: Config
  onChange: (patch: Partial<Config>) => void
  onClose: () => void
}

/** Le bouton « + Options » de l'accueil : renommer le jeu, choisir sa jaquette, retirer un jeu émulé. */
export default function GameOptions({ game, config, onChange, onClose }: Props): JSX.Element {
  const override = config.overrides[game.id] ?? {}
  const [title, setTitle] = useState(override.title ?? game.title)
  const [index, setIndex] = useState(0)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  useMoveSound(index)

  const saveOverride = (patch: { title?: string; icon?: string }): void =>
    onChange({ overrides: { ...config.overrides, [game.id]: { ...override, ...patch } } })

  const pickCover = async (): Promise<void> => {
    const icon = await window.api.pickImage()
    if (icon) saveOverride({ icon })
  }

  const clearCover = (): void => {
    const { icon: _icon, ...rest } = override
    onChange({ overrides: { ...config.overrides, [game.id]: rest } })
  }

  const rows = [
    { id: 'title', label: 'Renommer' },
    { id: 'cover', label: 'Choisir une jaquette…' },
    ...(override.icon ? [{ id: 'clear', label: 'Retirer ma jaquette' }] : []),
    ...(game.emulated ? [{ id: 'remove', label: 'Retirer ce jeu de la bibliothèque' }] : []),
    { id: 'close', label: 'Fermer' }
  ]

  const run = (id: string): void => {
    if (id === 'title') titleRef.current?.focus()
    else if (id === 'cover') void pickCover()
    else if (id === 'clear') clearCover()
    else if (id === 'remove') setConfirmRemove(true)
    else onClose()
  }

  useInput((action) => {
    if (action === 'up') setIndex((i) => Math.max(0, i - 1))
    else if (action === 'down') setIndex((i) => Math.min(rows.length - 1, i + 1))
    else if (action === 'confirm') run(rows[index].id)
    else if (action === 'back') onClose()
  })

  return (
    <>
      <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className="panel" role="dialog" aria-label="Options du jeu" data-native-input>
          <h2>Options</h2>
          <p className="panel-sub">{game.title}</p>
          <ul className="menu-list">
            {rows.map((r, i) => (
              <li key={r.id}>
                {r.id === 'title' ? (
                  <label className={`menu-row title-edit${index === i ? ' focused' : ''}`} onMouseEnter={() => setIndex(i)}>
                    <span>Renommer</span>
                    <input
                      ref={titleRef}
                      value={title}
                      maxLength={60}
                      onChange={(e) => setTitle(e.target.value)}
                      onBlur={() => saveOverride({ title: title.trim() || undefined })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') {
                          e.stopPropagation()
                          e.currentTarget.blur()
                        }
                      }}
                    />
                  </label>
                ) : (
                  <button className={`menu-row${index === i ? ' focused' : ''}`} onMouseEnter={() => setIndex(i)} onClick={() => run(r.id)}>
                    <span>{r.label}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {confirmRemove && (
        <ConfirmDialog
          title="Retirer ce jeu ?"
          message={`« ${game.title} » disparaîtra de la bibliothèque (le fichier du jeu n'est pas supprimé).`}
          confirmLabel="Retirer"
          onCancel={() => setConfirmRemove(false)}
          onConfirm={() => {
            onChange({ emulated: config.emulated.filter((e) => e.title.trim() !== game.sourceTitle) })
            setConfirmRemove(false)
            onClose()
          }}
        />
      )}
    </>
  )
}
