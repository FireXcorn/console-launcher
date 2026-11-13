import { useCallback, useEffect, useState } from 'react'
import type { RecipeInfo, RecipeState } from '../../../shared/types'

export const RECIPE_STATE: Record<RecipeState, string> = {
  'no-tool': 'Outil absent de cette installation',
  'needs-input': 'Il manque ton fichier de jeu',
  'needs-setup': 'À préparer',
  ready: 'Prêt'
}

/** Liste des jeux livrés avec leur outil ; tant qu'une préparation tourne, son avancement est relu toutes les 1,5 s. */
export function useRecipes(onReady?: () => void): { recipes: RecipeInfo[]; refresh: () => Promise<void>; setRecipes: (r: RecipeInfo[]) => void } {
  const [recipes, setRecipes] = useState<RecipeInfo[]>([])
  const refresh = useCallback(async (): Promise<void> => setRecipes(await window.api.listRecipes()), [])
  useEffect(() => {
    void refresh()
  }, [refresh])
  const anyRunning = recipes.some((r) => r.running)
  useEffect(() => {
    if (!anyRunning) return
    const timer = setInterval(() => void refresh(), 1500)
    return () => clearInterval(timer)
  }, [anyRunning, refresh])
  // Quand un jeu passe à « prêt », l'écran qui l'affiche peut actualiser la bibliothèque.
  const readyCount = recipes.filter((r) => r.state === 'ready').length
  const [seenReady, setSeenReady] = useState<number | null>(null)
  useEffect(() => {
    if (recipes.length === 0) return
    if (seenReady !== null && readyCount > seenReady) onReady?.()
    setSeenReady(readyCount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyCount, recipes.length])
  return { recipes, refresh, setRecipes }
}

interface Props {
  recipe: RecipeInfo
  onChange: (list: RecipeInfo[]) => void
  /** Phrase d'aide en tête (fenêtre guide). */
  showGuide?: boolean
}

/** Un jeu à préparer : ce qu'il faut fournir, le bouton de préparation et son avancement. */
export default function RecipeCard({ recipe: r, onChange, showGuide }: Props): JSX.Element {
  const give = async (need: RecipeInfo['needs'][number]): Promise<void> => {
    const path = need.kind === 'folder' ? await window.api.pickFolder() : await window.api.pickFile()
    if (path) onChange(await window.api.setRecipeInput(r.id, need.id, path))
  }
  const refresh = (): Promise<void> => window.api.listRecipes().then(onChange)

  return (
    <div className="recipe-row">
      <div className="recipe-head">
        <span className="recipe-title">{r.title}</span>
        <span className={'recipe-state ' + r.state}>{RECIPE_STATE[r.state]}</span>
      </div>
      {showGuide && r.guide && <p className="recipe-guide">{r.guide}</p>}
      {r.state !== 'no-tool' &&
        r.needs.map((n) => (
          <div className="field-row" key={n.id}>
            <input readOnly value={r.inputs[n.id] ?? ''} placeholder={n.label} aria-label={n.label} />
            <button onClick={() => void give(n)}>Choisir mon fichier…</button>
          </div>
        ))}
      {r.running && (
        <div className="field-row">
          <span className="recipe-progress">{r.progress || 'Préparation en cours…'}</span>
          <button onClick={() => void window.api.cancelRecipeSetup(r.id)}>Annuler</button>
        </div>
      )}
      {r.state === 'needs-setup' && r.hasSetup && !r.running && (
        <div className="field-row">
          <button className="primary" onClick={() => void window.api.runRecipeSetup(r.id).then(refresh)}>
            Préparer le jeu
          </button>
          <button onClick={() => void refresh()}>Vérifier</button>
        </div>
      )}
      {!r.running && r.progress && <small className="recipe-error">{r.progress}</small>}
      {r.note && r.state !== 'ready' && r.state !== 'no-tool' && <small>{r.note}</small>}
      {r.state === 'no-tool' && <small>Cette version du lanceur ne contient pas l’outil de ce jeu.</small>}
    </div>
  )
}
