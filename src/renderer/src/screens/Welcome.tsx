import { useState } from 'react'
import Screen from '../components/Screen'
import { useInput } from '../hooks/useInput'

interface Props {
  /** Choisit un dossier de jeux et les ajoute tous ; renvoie le nombre de jeux ajoutés. */
  onImport: () => Promise<number>
  /** Lance la visite guidée sur l'accueil. */
  onTour: () => void
  /** Ferme l'assistant sans rien ajouter. */
  onLater: () => void
}

/** Écran de bienvenue : ce que voit quelqu'un qui n'a encore aucun jeu dans le lanceur. */
export default function Welcome({ onImport, onTour, onLater }: Props): JSX.Element {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const importFolder = async (): Promise<void> => {
    setBusy(true)
    const count = await onImport()
    setBusy(false)
    if (count === 0) setMessage('Aucun jeu trouvé dans ce dossier. Le lanceur cherche un programme (.exe) par sous-dossier.')
  }

  // Clavier et manette : les flèches choisissent un bouton, Valider l'active ; seul Échap (clavier) ferme.
  const [index, setIndex] = useState(0)
  const actions = [onTour, () => void importFolder(), onLater]
  useInput((action, source) => {
    if (action === 'left' || action === 'up') setIndex((i) => Math.max(0, i - 1))
    else if (action === 'right' || action === 'down') setIndex((i) => Math.min(actions.length - 1, i + 1))
    else if (action === 'confirm' && !busy) actions[index]()
    else if (action === 'back' && source === 'key') onLater()
  })
  const cls = (i: number, base = ''): string => `${base}${index === i ? ' focused' : ''}`.trim()

  return (
    <Screen title="Bienvenue" onBack={onLater}>
      <div className="welcome">
        <p>
          Les jeux de ta console t’attendent, avec leurs outils déjà installés. Il te manque seulement <strong>ta cartouche</strong> :
          ton propre fichier de jeu. On te montre comment faire.
        </p>
        <div className="welcome-actions">
          <button className={cls(0, 'primary')} disabled={busy} onClick={onTour} onMouseEnter={() => setIndex(0)}>
            Commencer la visite
          </button>
          <button className={cls(1)} disabled={busy} onClick={() => void importFolder()} onMouseEnter={() => setIndex(1)}>
            Importer un dossier de jeux…
          </button>
          <button className={cls(2)} disabled={busy} onClick={onLater} onMouseEnter={() => setIndex(2)}>
            Plus tard
          </button>
        </div>
        {message && <p className="settings-note">{message}</p>}
        <small className="welcome-hint">
          Tu pourras toujours revoir la visite dans <em>Paramètres → Avancé</em>, et ajouter des jeux dans <em>Paramètres → Ajouter des
          jeux</em>.
        </small>
      </div>
    </Screen>
  )
}
