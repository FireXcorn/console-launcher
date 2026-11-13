import type { ReactNode } from 'react'
import { engine } from '../audio/engine'
import StatusCluster from './StatusCluster'

export interface Hint {
  key: string
  label: string
  /** Touche de forme rectangulaire (clavier) plutôt que ronde (bouton de manette). */
  wide?: boolean
}

interface Props {
  title: string
  hints?: Hint[]
  onBack: () => void
  children: ReactNode
}

/** Cadre commun des écrans : titre, contenu défilant et rappel des touches. */
export default function Screen({ title, hints = [], onBack, children }: Props): JSX.Element {
  return (
    <div className="screen">
      <header className="screen-head">
        <button
          className="back-btn"
          onClick={() => {
            engine.play('retour')
            onBack()
          }}
          aria-label="Retour"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <h1>{title}</h1>
        <div className="screen-status">
          <StatusCluster />
        </div>
      </header>
      <div className="screen-body">{children}</div>
      <footer className="screen-foot">
        {[...hints, { key: 'B', label: 'Retour' }].map((h) => (
          <span className="hint" key={h.label}>
            <span className={`hint-key${h.wide ? ' wide' : ''}`}>{h.key}</span>
            {h.label}
          </span>
        ))}
      </footer>
    </div>
  )
}
