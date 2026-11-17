import { useCallback, useEffect, useState } from 'react'
import type { MediaAction, MediaState } from '../../../shared/types'

/** État du lecteur de musique (Spotify, Apple Music…), relu toutes les 4 secondes tant que l'écran est affiché. `null` : rien à afficher. */
export function useMedia(active: boolean): { media: MediaState | null; control: (action: MediaAction) => void } {
  const [media, setMedia] = useState<MediaState | null>(null)
  useEffect(() => {
    if (!active) return
    let alive = true
    const read = (): void => void window.api.mediaState().then((m) => alive && setMedia(m.available ? m : null))
    read()
    const timer = setInterval(read, 4000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [active])
  const control = useCallback((action: MediaAction): void => {
    void window.api.mediaControl(action).then((m) => setMedia(m.available ? m : null))
  }, [])
  return { media, control }
}
