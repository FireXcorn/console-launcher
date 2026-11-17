import { useCallback, useEffect, useState } from 'react'
import type { AppInfo } from '../../../shared/types'
import Screen from '../components/Screen'
import { useInput } from '../hooks/useInput'

/**
 * « Applis » : une jaquette par application (Pokémon Home…). Une application livrée s'ouvre d'un clic, dans la
 * fenêtre du lanceur. Une application à télécharger affiche ses deux étapes sous les jaquettes.
 */
export default function AppsScreen({ onBack }: { onBack: () => void }): JSX.Element {
  const [apps, setApps] = useState<AppInfo[]>([])
  const [pos, setPos] = useState(0)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => setApps(await window.api.listApps()), [])
  useEffect(() => {
    void refresh()
  }, [refresh])

  const current: AppInfo | undefined = apps[pos]

  const install = async (app: AppInfo): Promise<void> => {
    const file = await window.api.pickFile()
    if (!file) return
    setBusy(true)
    setMessage('Installation en cours…')
    const err = await window.api.installApp(app.id, file)
    setBusy(false)
    setMessage(err ?? `${app.title} est installé : tu peux l’ouvrir.`)
    await refresh()
  }
  const open = async (app: AppInfo): Promise<void> => {
    if (!app.supported) return setMessage('Pas encore disponible sur ce système.')
    if (!app.installed) return setMessage('')
    setMessage('Ouverture…')
    setMessage((await window.api.openApp(app.id)) ?? '')
  }

  useInput((action) => {
    if (action === 'back') onBack()
    else if (action === 'left') setPos((p) => Math.max(p - 1, 0))
    else if (action === 'right') setPos((p) => Math.min(p + 1, apps.length - 1))
    else if (action === 'confirm' && current) void open(current)
  })

  return (
    <Screen title="Applis" onBack={onBack} hints={[{ key: 'A', label: 'Ouvrir' }]}>
      <div className="pokemon">
        <div className="pokemon-row">
          {apps.map((app, i) => (
            <button
              key={app.id}
              className={`pokemon-game${i === pos ? ' focused' : ''}${app.installed ? '' : ' empty'}`}
              onMouseEnter={() => setPos(i)}
              onClick={() => void open(app)}
              aria-label={app.title}
            >
              {app.icon ? <img src={app.icon} alt="" draggable={false} /> : <span className="pokemon-fallback">{app.title}</span>}
            </button>
          ))}
        </div>
        {current && (
          <p className="pokemon-title">
            {current.title}
            <small>{current.description}</small>
          </p>
        )}
        {current?.supported && !current.installed && (
          <div className="field-row">
            <button className="primary" onClick={() => void window.api.openAppPage(current.id)}>
              1. Ouvrir la page de téléchargement
            </button>
            <button disabled={busy} onClick={() => void install(current)}>
              2. Choisir {current.fileHint}…
            </button>
          </div>
        )}
        {current?.note && <small className="app-note">{current.note}</small>}
        {message && <p className="settings-note">{message}</p>}
        <small className="app-note">
          N’utilise que tes propres sauvegardes. Garde une copie de tes sauvegardes avant de modifier quoi que ce soit.
        </small>
      </div>
    </Screen>
  )
}
