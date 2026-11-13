import { useEffect, useRef } from 'react'

/**
 * `option` : action secondaire d'un écran (supprimer, actualiser) ; touche Suppr ou bouton Y.
 * `menu` : le bouton « + » (Options) de l'accueil ; touche Tab ou bouton Start.
 */
export type Action = 'left' | 'right' | 'up' | 'down' | 'confirm' | 'back' | 'option' | 'menu' | 'prevTab' | 'nextTab'

const DIRECTIONS: ReadonlySet<Action> = new Set(['left', 'right', 'up', 'down'])
const FIRST_REPEAT_MS = 350
const REPEAT_MS = 110
const STICK = 0.6

/**
 * Interroge les manettes à chaque image et émet des actions de navigation.
 * `swap` inverse valider/retour (bouton de droite = valider, comme sur une manette Nintendo).
 */
export function useGamepad(onAction: (a: Action) => void, enabled: boolean, swap: boolean): void {
  const cb = useRef(onAction)
  cb.current = onAction

  useEffect(() => {
    if (!enabled) return
    let raf = 0
    let primed = false
    // Action maintenue -> instant de la prochaine répétition.
    const held = new Map<Action, number>()

    const tick = (now: number): void => {
      const down = new Set<Action>()
      for (const pad of navigator.getGamepads()) {
        if (!pad) continue
        const b = (i: number): boolean => pad.buttons[i]?.pressed ?? false
        const x = pad.axes[0] ?? 0
        const y = pad.axes[1] ?? 0
        if (b(14) || x < -STICK) down.add('left')
        if (b(15) || x > STICK) down.add('right')
        if (b(12) || y < -STICK) down.add('up')
        if (b(13) || y > STICK) down.add('down')
        if (b(swap ? 1 : 0)) down.add('confirm')
        if (b(swap ? 0 : 1)) down.add('back')
        if (b(3)) down.add('option')
        if (b(9)) down.add('menu')
        if (b(4)) down.add('prevTab')
        if (b(5)) down.add('nextTab')
      }

      for (const a of down) {
        const next = held.get(a)
        if (next === undefined) {
          // Au premier passage, on ignore ce qui est déjà enfoncé (retour d'un jeu, par exemple).
          if (primed) cb.current(a)
          held.set(a, primed ? now + FIRST_REPEAT_MS : Infinity)
        } else if (now >= next && DIRECTIONS.has(a)) {
          cb.current(a)
          held.set(a, now + REPEAT_MS)
        }
      }
      for (const a of [...held.keys()]) if (!down.has(a)) held.delete(a)

      primed = true
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [enabled, swap])
}
