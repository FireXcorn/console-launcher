import { useInput } from '../hooks/useInput'

interface Props {
  /** Jeu de la tuile « Cartouche vide » sélectionnée. */
  title: string
  /** Ouvre Paramètres → Ajouter des jeux pour ce jeu. */
  onAdd: () => void
  onClose: () => void
}

/**
 * « Pas d'outil livré pour ce jeu » : explique comment brancher soi-même un émulateur ou un outil de recompilation
 * trouvé sur GitHub. A ouvre l'ajout ; B ferme.
 */
export default function ToolGuide({ title, onAdd, onClose }: Props): JSX.Element {
  useInput((action) => {
    if (action === 'back') onClose()
    else if (action === 'confirm') onAdd()
  })

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog recipe-guide-window" role="dialog" aria-label={`Ajouter un outil pour ${title}`}>
        <h2>{title}</h2>
        <p className="recipe-guide">
          Aucun outil n’est livré avec ce jeu. Si tu en as trouvé un (un émulateur ou un outil de recompilation, souvent sur GitHub),
          tu peux le brancher toi-même :
        </p>
        <ol className="tool-steps">
          <li>Télécharge l’outil depuis la page officielle de son auteur et décompresse-le dans un dossier.</li>
          <li>Prépare-le en suivant son mode d’emploi, avec <strong>ton</strong> fichier de jeu.</li>
          <li>
            Clique sur <strong>Ajouter mon outil</strong> : choisis le programme (.exe) de l’outil, puis ton fichier de jeu.
          </li>
          <li>Le jeu remplace cette « Cartouche vide » et se lance depuis le menu.</li>
        </ol>
        <p className="recipe-footnote">Tout se fait aussi dans Paramètres → Ajouter des jeux. Guide complet : docs/ajouter-un-outil.md.</p>
        <div className="dialog-actions">
          <button className="primary" onClick={onAdd}>
            Ajouter mon outil
          </button>
          <button onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  )
}
