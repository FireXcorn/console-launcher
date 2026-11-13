import { useState } from 'react'
import { useMoveSound } from '../audio/useSound'
import { useInput } from '../hooks/useInput'

interface Props {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

/** Demande de confirmation ; la sélection démarre sur « Annuler » pour éviter un faux pas. */
export default function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: Props): JSX.Element {
  const [index, setIndex] = useState(0)
  useMoveSound(index)

  useInput((action) => {
    if (action === 'left') setIndex(0)
    else if (action === 'right') setIndex(1)
    else if (action === 'back') onCancel()
    else if (action === 'confirm') (index === 1 ? onConfirm : onCancel)()
  })

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="panel" role="alertdialog" aria-label={title}>
        <h2>{title}</h2>
        <p>{message}</p>
        <div className="panel-actions">
          <button className={`btn${index === 0 ? ' focused' : ''}`} onClick={onCancel} onMouseEnter={() => setIndex(0)}>
            Annuler
          </button>
          <button
            className={`btn danger${index === 1 ? ' focused' : ''}`}
            onClick={onConfirm}
            onMouseEnter={() => setIndex(1)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
