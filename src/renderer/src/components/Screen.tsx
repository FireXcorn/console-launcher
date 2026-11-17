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
  /** Image de fond derrière le contenu (ex. fond du jeu sélectionné). */
  backdrop?: ReactNode
  children: ReactNode
}

const backBtn = (): HTMLElement | null => document.querySelector<HTMLElement>('.screen-head .back-btn')

/** Manette : place la sélection sur le bouton Retour (en haut à gauche). */
export function focusBack(): void {
  backBtn()?.focus()
}

/** Manette : tant que Retour est sélectionné, A le valide et bas/droite rendent la main à l'écran. Renvoie true si l'action est consommée. */
export function backNav(action: string): boolean {
  const btn = backBtn()
  if (!btn || document.activeElement !== btn) return false
  if (action === 'confirm') btn.click()
  else if (action === 'down' || action === 'right') btn.blur()
  return true
}

/** Cadre commun des écrans : titre, contenu défilant et rappel des touches. */
export default function Screen({ title, hints = [], onBack, backdrop, children }: Props): JSX.Element {
  return (
    <div className="screen">
      {backdrop}
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
