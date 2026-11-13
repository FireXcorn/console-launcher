import { useState } from 'react'
import Screen from '../components/Screen'

interface Props {
  /** Choisit un dossier de jeux et les ajoute tous ; renvoie le nombre de jeux ajoutés. */
  onImport: () => Promise<number>
  /** Ouvre « Ajouter des jeux » dans les paramètres. */
  onManual: () => void
  /** Ferme l'assistant sans rien ajouter. */
  onLater: () => void
}

/** Écran de bienvenue : ce que voit quelqu'un qui n'a encore aucun jeu dans le lanceur. */
export default function Welcome({ onImport, onManual, onLater }: Props): JSX.Element {
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
          Ce lanceur n’a pas encore de jeu. Il lance <strong>tes</strong> jeux : des programmes PC, des jeux recompilés ou des jeux sur
          émulateur. Il ne fournit ni jeu ni émulateur.
        </p>
        <div className="welcome-actions">
          <button className="primary" disabled={busy} onClick={() => void importFolder()}>
            Importer un dossier de jeux…
          </button>
          <button disabled={busy} onClick={onManual}>
            Ajouter un jeu à la main
          </button>
          <button disabled={busy} onClick={onLater}>
            Plus tard
          </button>
        </div>
        {message && <p className="settings-note">{message}</p>}
        <small className="welcome-hint">
          Tu pourras toujours en ajouter dans <em>Paramètres de la console → Ajouter des jeux</em>. En jeu, Ctrl+Alt+Q (ou Retour + Menu
          maintenus 2 secondes sur manette) ramène au menu.
        </small>
      </div>
    </Screen>
  )
}
