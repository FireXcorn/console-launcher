import { createContext, useContext, useEffect, useRef, type MutableRefObject } from 'react'
import type { Action } from './useGamepad'

export type InputSource = 'key' | 'pad'
export type InputHandler = (action: Action, source: InputSource) => void
type HandlerRef = MutableRefObject<InputHandler>

export interface InputStack {
  push(ref: HandlerRef): () => void
}

export const InputContext = createContext<InputStack | null>(null)

/**
 * Reçoit les actions de navigation (clavier et manette) tant que le composant est affiché.
 * Le dernier composant monté (fenêtre ou écran le plus « au-dessus ») est seul à les recevoir.
 */
export function useInput(handler: InputHandler): void {
  const ref = useRef(handler)
  ref.current = handler
  const stack = useContext(InputContext)
  useEffect(() => stack?.push(ref), [stack])
}
