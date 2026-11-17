import { useState } from 'react'
import { ADD_KINDS, AddCards, type AddKind } from '../components/AddGame'
import Screen from '../components/Screen'
import { useInput } from '../hooks/useInput'

interface Props {
  /** Ouvre l'assistant « Ajouter un jeu » sur ce type de jeu. */
  onAdd: (kind: AddKind) => void
  /** Lance la visite guidée sur l'accueil. */
  onTour: () => void
  /** Ferme l'écran sans rien ajouter. */
  onLater: () => void
}

/** Écran de bienvenue : trois cartes pour ajouter son premier jeu, la visite guidée, ou plus tard. */
export default function Welcome({ onAdd, onTour, onLater }: Props): JSX.Element {
  // Sélection : 0 à 2 = les cartes, 3 = visite, 4 = plus tard.
  const [index, setIndex] = useState(0)
  const cards = ADD_KINDS.length
  const actions = [...ADD_KINDS.map((k) => () => onAdd(k.id)), onTour, onLater]
  useInput((action, source) => {
    if (action === 'left') setIndex((i) => Math.max(0, i - 1))
    else if (action === 'right') setIndex((i) => Math.min(actions.length - 1, i + 1))
    else if (action === 'down') setIndex((i) => (i < cards ? cards : i))
    else if (action === 'up') setIndex((i) => (i >= cards ? 1 : i))
    else if (action === 'confirm') actions[index]()
    else if (action === 'back' && source === 'key') onLater()
  })
  const cls = (i: number, base = ''): string => `${base}${index === i ? ' focused' : ''}`.trim()

  return (
    <Screen title="Bienvenue" onBack={onLater} hints={[{ key: 'A', label: 'Choisir' }]}>
      <div className="welcome">
        <h1>Bienvenue sur ta console !</h1>
        <p>Qu’est-ce que tu veux ajouter pour commencer ? Le lanceur te guide pas à pas.</p>
        <AddCards focused={index < cards ? index : -1} onHover={setIndex} onPick={onAdd} />
        <div className="welcome-actions">
          <button className={cls(cards)} onClick={onTour} onMouseEnter={() => setIndex(cards)}>
            Faire la visite guidée
          </button>
          <button className={cls(cards + 1)} onClick={onLater} onMouseEnter={() => setIndex(cards + 1)}>
            Plus tard
          </button>
        </div>
        <small className="welcome-hint">
          Tu retrouveras tout ça dans <em>Paramètres → Ajouter des jeux</em>, et la visite dans <em>Paramètres → Avancé</em>.
        </small>
      </div>
    </Screen>
  )
}
