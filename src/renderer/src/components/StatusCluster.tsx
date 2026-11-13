import { useEffect, useState } from 'react'
import { useBattery, useClock } from '../hooks/useClock'

/**
 * Wi-Fi : deux arcs et un petit éventail en bas. Autant d'éléments pleins que la qualité du signal
 * (pourcentage) le permet, les autres sont estompés.
 */
function WifiBars({ signal }: { signal: number | null }): JSX.Element {
  const level = signal === null ? 3 : signal >= 75 ? 3 : signal >= 45 ? 2 : signal >= 15 ? 1 : 0
  return (
    <svg viewBox="0 0 24 18" fill="none" strokeWidth="3.3" strokeLinecap="round" aria-hidden="true">
      <path d="M2.2 6.4A14 14 0 0 1 21.8 6.4" stroke="currentColor" opacity={level >= 3 ? 1 : 0.25} />
      <path d="M6.4 10.8A8.6 8.6 0 0 1 17.6 10.8" stroke="currentColor" opacity={level >= 2 ? 1 : 0.25} />
      <path d="M12 17.6 8.6 14.2A4.8 4.8 0 0 1 15.4 14.2Z" fill="currentColor" strokeWidth="1" stroke="currentColor" opacity={level >= 1 ? 1 : 0.25} />
    </svg>
  )
}
/**
 * Heure, Wi-Fi et batterie : le coin en haut à droite de l'accueil et de chaque écran.
 * Pas de pourcentage de batterie : seule la jauge est affichée.
 */
export default function StatusCluster(): JSX.Element {
  const time = useClock()
  const battery = useBattery()
  const [online, setOnline] = useState(navigator.onLine)
  const [signal, setSignal] = useState<number | null>(null)
  useEffect(() => {
    const update = (): void => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  useEffect(() => {
    let alive = true
    const read = (): void => {
      window.api.networkInfo().then((n) => alive && setSignal(n.signal))
    }
    read()
    const id = setInterval(read, 20000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  const level = battery?.level ?? 1
  return (
    <>
      <span className="clock">
        {time.time.split(':')[0]}
        <span className="colon">:</span>
        {time.time.split(':')[1]}
        {time.period && <small>{time.period}</small>}
      </span>
      {online && (
        <span className="status-icon">
          <WifiBars signal={signal} />
        </span>
      )}
      <span className={`battery-body${battery?.charging ? ' charging' : ''}`}>
        <span className="battery-fill" style={{ width: `${level * 100}%` }} />
        {battery?.charging && (
          <svg className="battery-bolt" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true">
            <path d="M6 0 1 7h3l-1 5 6-8H6z" />
          </svg>
        )}
      </span>
    </>
  )
}
