import { useEffect } from 'react'
import { useInput } from '../hooks/useInput'
import RecipeCard, { useRecipes } from './RecipeCard'

interface Props {
  /** Jeu dont on ajoute la cartouche. */
  recipeId: string
  title: string
  /** Appelé quand le jeu devient prêt : le menu relit la bibliothèque. */
  onReady: () => void
  onClose: () => void
}

/**
 * « Il manque ta cartouche » : ce qu'il faut apporter pour ce jeu, le choix du fichier, puis la préparation avec
 * sa progression. A fait l'étape suivante ; B ferme.
 */
export default function RecipeGuide({ recipeId, title, onReady, onClose }: Props): JSX.Element {
  const { recipes, setRecipes } = useRecipes(onReady)
  const recipe = recipes.find((r) => r.id === recipeId)

  // Dès que le jeu est prêt, la fenêtre se referme d'elle-même.
  useEffect(() => {
    if (recipe?.state === 'ready') {
      onReady()
      onClose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe?.state])

  const next = async (): Promise<void> => {
    if (!recipe) return
    if (recipe.state === 'needs-input') {
      const need = recipe.needs.find((n) => !n.optional && !recipe.inputs[n.id])
      if (!need) return
      const path = need.kind === 'folder' ? await window.api.pickFolder() : await window.api.pickFile()
      if (path) setRecipes(await window.api.setRecipeInput(recipe.id, need.id, path))
    } else if (recipe.state === 'needs-setup' && recipe.hasSetup && !recipe.running) {
      await window.api.runRecipeSetup(recipe.id)
      setRecipes(await window.api.listRecipes())
    } else if (recipe.state === 'no-tool') onClose()
  }

  useInput((action) => {
    if (action === 'back') onClose()
    else if (action === 'confirm') void next()
  })

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog recipe-guide-window" role="dialog" aria-label={`Il manque ta cartouche : ${title}`}>
        <h2>Il manque ta cartouche</h2>
        {recipe ? (
          <RecipeCard recipe={recipe} onChange={setRecipes} showGuide />
        ) : (
          <p>Ce jeu n’est plus proposé par cette version du lanceur.</p>
        )}
        <p className="recipe-footnote">Tout se règle aussi dans Paramètres → Ajouter des jeux.</p>
        <div className="dialog-actions">
          <button onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  )
}
