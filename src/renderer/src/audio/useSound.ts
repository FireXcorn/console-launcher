import { useEffect, useRef } from 'react'
import { engine } from './engine'

/** Joue le petit tic de déplacement chaque fois que `selection` change (pas au premier affichage). */
export function useMoveSound(selection: unknown): void {
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    engine.play('deplacer')
  }, [selection])
}
