import { useEffect, useState } from 'react'
import type { Config } from '../../../shared/types'
import Screen from '../components/Screen'
import { useInput } from '../hooks/useInput'

interface PadState {
  index: number
  id: string
  buttons: boolean[]
  axes: number[]
}

// Noms des 17 boutons de la disposition standard (« standard mapping »).
const BUTTON_NAMES = [
  'Bas', 'Droite', 'Gauche', 'Haut', 'L', 'R', 'ZL', 'ZR', 'Sélection', 'Start', 'L3', 'R3', '↑', '↓', '←', '→', 'Home'
]

function readPads(): PadState[] {
  return [...navigator.getGamepads()]
    .filter((p): p is Gamepad => p !== null)
    .map((p) => ({
      index: p.index,
      id: p.id.replace(/\s*\(.*?\)\s*/g, ' ').trim() || 'Manette',
      buttons: p.buttons.map((b) => b.pressed),
      axes: p.axes.map((a) => Math.round(a * 100) / 100)
    }))
}

function usePads(): PadState[] {
  const [pads, setPads] = useState<PadState[]>(readPads)
  useEffect(() => {
    let raf = 0
    let last = ''
    const tick = (): void => {
      const next = readPads()
      const key = JSON.stringify(next)
      if (key !== last) {
        last = key
        setPads(next)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return pads
}

function Stick({ x, y, label }: { x: number; y: number; label: string }): JSX.Element {
  return (
    <div className="stick" aria-label={label}>
      <span className="stick-dot" style={{ left: `${50 + x * 40}%`, top: `${50 + y * 40}%` }} />
    </div>
  )
}

interface Props {
  config: Config
  onChange: (patch: Partial<Config>) => void
  onBack: () => void
}

export default function ControllersScreen({ config, onChange, onBack }: Props): JSX.Element {
  const pads = usePads()
  const toggle = (): void => onChange({ swapConfirm: !config.swapConfirm })

  // Un appui sur la manette sert ici de test : seul le clavier ou la souris bascule le réglage.
  useInput((action, source) => {
    if (action === 'back') onBack()
    else if (action === 'confirm' && source === 'key') toggle()
  })

  return (
    <Screen title="Manettes" onBack={onBack} hints={[{ key: 'Entrée', label: 'Inverser A / B', wide: true }]}>
      <div className="controllers">
        <button className="toggle-row focused" onClick={toggle}>
          <span>
            Valider avec le bouton de droite
            <small>Disposition Nintendo : A à droite, B en bas.</small>
          </span>
          <span className={`switch${config.swapConfirm ? ' on' : ''}`} aria-checked={config.swapConfirm} role="switch" />
        </button>

        {pads.length === 0 ? (
          <div className="screen-empty">
            <h2>Aucune manette détectée</h2>
            <p>Branche ou connecte une manette, puis appuie sur l’un de ses boutons.</p>
          </div>
        ) : (
          pads.map((pad) => (
            <section className="pad" key={pad.index}>
              <h2>{pad.id}</h2>
              <div className="pad-body">
                <div className="pad-buttons">
                  {pad.buttons.slice(0, BUTTON_NAMES.length).map((down, i) => (
                    <span key={i} className={`pad-btn${down ? ' down' : ''}`}>
                      {BUTTON_NAMES[i]}
                    </span>
                  ))}
                </div>
                <div className="pad-sticks">
                  <Stick x={pad.axes[0] ?? 0} y={pad.axes[1] ?? 0} label="Stick gauche" />
                  <Stick x={pad.axes[2] ?? 0} y={pad.axes[3] ?? 0} label="Stick droit" />
                </div>
              </div>
            </section>
          ))
        )}
      </div>
    </Screen>
  )
}
