import { useState } from 'react'
import type { PowerAction } from '../../../shared/types'
import { useMoveSound } from '../audio/useSound'
import { useInput } from '../hooks/useInput'
import ConfirmDialog from './ConfirmDialog'
import { PowerIcon } from './icons'

type Entry =
  | { id: 'quit'; label: string; hint: string }
  | { id: PowerAction; label: string; hint: string; question: string; confirm: string }

const ENTRIES: Entry[] = [
  { id: 'quit', label: 'Quitter le lanceur', hint: 'Ferme cette application' },
  {
    id: 'sleep',
    label: 'Mettre le PC en veille',
    hint: 'Met l’ordinateur en veille',
    question: 'Mettre le PC en veille ?',
    confirm: 'Mettre en veille'
  },
  {
    id: 'restart',
    label: 'Redémarrer le PC',
    hint: 'Les programmes ouverts seront fermés',
    question: 'Redémarrer le PC ?',
    confirm: 'Redémarrer'
  },
  {
    id: 'shutdown',
    label: 'Éteindre le PC',
    hint: 'Les programmes ouverts seront fermés',
    question: 'Éteindre le PC ?',
    confirm: 'Éteindre'
  }
]

interface Props {
  onClose: () => void
  onQuit: () => void
  /** Entrée présélectionnée : « Mettre le PC en veille » (1) quand on vient de l'icône Mode veille. */
  initialIndex?: number
}

export default function PowerMenu({ onClose, onQuit, initialIndex = 0 }: Props): JSX.Element {
  const [index, setIndex] = useState(initialIndex)
  useMoveSound(index)
  const [pending, setPending] = useState<Extract<Entry, { question: string }> | null>(null)

  const choose = (i: number): void => {
    const entry = ENTRIES[i]
    if (entry.id === 'quit') onQuit()
    else setPending(entry as Extract<Entry, { question: string }>)
  }

  useInput((action) => {
    if (action === 'up') setIndex((i) => Math.max(0, i - 1))
    else if (action === 'down') setIndex((i) => Math.min(ENTRIES.length - 1, i + 1))
    else if (action === 'confirm') choose(index)
    else if (action === 'back') onClose()
  })

  return (
    <>
      <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className="panel" role="menu" aria-label="Alimentation">
          <h2>
            <span className="panel-icon">
              <PowerIcon />
            </span>
            Alimentation
          </h2>
          <ul className="menu-list">
            {ENTRIES.map((e, i) => (
              <li key={e.id}>
                <button
                  className={`menu-row${index === i ? ' focused' : ''}`}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => choose(i)}
                >
                  <span>{e.label}</span>
                  <small>{e.hint}</small>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {pending && (
        <ConfirmDialog
          title={pending.question}
          message={pending.hint}
          confirmLabel={pending.confirm}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            window.api.power(pending.id)
            setPending(null)
            onClose()
          }}
        />
      )}
    </>
  )
}
