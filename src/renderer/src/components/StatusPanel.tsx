import { useEffect, useState } from 'react'
import { useMoveSound } from '../audio/useSound'
import { useInput } from '../hooks/useInput'
import { useBattery } from '../hooks/useClock'
import { WifiIcon } from './icons'

const ACTIONS = [
  { label: 'Paramètres d’alimentation', url: 'ms-settings:powersleep' },
  { label: 'Paramètres réseau', url: 'ms-settings:network-wifi' },
  { label: 'Fermer', url: '' }
]

export default function StatusPanel({ onClose }: { onClose: () => void }): JSX.Element {
  const battery = useBattery()
  const [ssid, setSsid] = useState<string | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  const [index, setIndex] = useState(0)
  useMoveSound(index)

  useEffect(() => {
    window.api.networkInfo().then((n) => setSsid(n.ssid))
    const update = (): void => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  const run = (i: number): void => {
    const url = ACTIONS[i].url
    if (url) window.api.openExternal(url)
    else onClose()
  }

  useInput((action) => {
    if (action === 'up') setIndex((i) => Math.max(0, i - 1))
    else if (action === 'down') setIndex((i) => Math.min(ACTIONS.length - 1, i + 1))
    else if (action === 'confirm') run(index)
    else if (action === 'back') onClose()
  })

  const percent = battery ? Math.round(battery.level * 100) : null

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel" role="dialog" aria-label="État du système">
        <h2>État du système</h2>

        <div className="stat">
          <span className="battery-body big">
            <span className="battery-fill" style={{ width: `${percent ?? 100}%` }} />
          </span>
          <div>
            <strong>{percent === null ? 'Secteur' : `${percent} %`}</strong>
            <small>
              {percent === null
                ? 'Aucune batterie détectée'
                : battery?.charging
                  ? 'En charge'
                  : 'Sur batterie'}
            </small>
          </div>
        </div>

        <div className="stat">
          <span className={`wifi-big${online ? '' : ' off'}`}>
            <WifiIcon />
          </span>
          <div>
            <strong>{online ? (ssid ?? 'Connecté') : 'Hors ligne'}</strong>
            <small>{online ? (ssid ? 'Réseau Wi-Fi' : 'Connexion réseau active') : 'Aucune connexion'}</small>
          </div>
        </div>

        <ul className="menu-list compact">
          {ACTIONS.map((a, i) => (
            <li key={a.label}>
              <button
                className={`menu-row${index === i ? ' focused' : ''}`}
                onMouseEnter={() => setIndex(i)}
                onClick={() => run(i)}
              >
                <span>{a.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
