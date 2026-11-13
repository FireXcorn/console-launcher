import { useState } from 'react'
import Screen from '../components/Screen'

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

  return (
    <Screen title="Bienvenue" onBack={onLater}>
      <div className="welcome">
        <p>
          Les jeux de ta console t’attendent, avec leurs outils déjà installés. Il te manque seulement <strong>ta cartouche</strong> :
          ton propre fichier de jeu. On te montre comment faire.
        </p>
        <div className="welcome-actions">
          <button className="primary" disabled={busy} onClick={onTour}>
            Commencer la visite
          </button>
          <button disabled={busy} onClick={() => void importFolder()}>
            Importer un dossier de jeux…
          </button>
          <button disabled={busy} onClick={onLater}>
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
