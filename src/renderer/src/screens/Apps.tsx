import { useCallback, useEffect, useState } from 'react'
import type { AppInfo } from '../../../shared/types'
import Screen, { backNav, focusBack } from '../components/Screen'
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
  // Pendant une installation en arrière-plan, on relit l'état : dès qu'elle est finie, l'application est prête.
  const installing = apps.some((a) => a.installing)
  useEffect(() => {
    if (!installing) return
    const timer = setInterval(() => void refresh(), 3000)
    return () => clearInterval(timer)
  }, [installing, refresh])

  /** Application installée à part (Spotify…) : le lanceur l'installe tout seul si le système sait le faire, sinon il ouvre sa page. */
  const installAuto = async (app: AppInfo): Promise<void> => {
    if (app.installing) return
    if (!app.canInstall) return void window.api.openAppPage(app.id)
    setMessage(`Installation de ${app.title} en arrière-plan… Elle sera prête ici dans quelques minutes.`)
    await window.api.installAppAuto(app.id)
    await refresh()
  }

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
    if (!app.installed) return app.external ? installAuto(app) : setMessage('')
    setMessage('Ouverture…')
    setMessage((await window.api.openApp(app.id)) ?? '')
  }

  useInput((action) => {
    if (action !== 'back' && backNav(action)) return
    if (action === 'back') onBack()
    else if (action === 'up') focusBack()
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
              {app.external && app.supported && !app.installed && <span className="pokemon-badge">{app.installing ? 'Installation…' : 'Installer'}</span>}
            </button>
          ))}
          {Array.from({ length: Math.max(0, 6 - apps.length) }, (_, i) => (
            <div key={`vide-${i}`} className="pokemon-game empty-slot" aria-hidden="true" />
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
            <button
              className="primary"
              disabled={current.installing}
              onClick={() => (current.external ? void installAuto(current) : void window.api.openAppPage(current.id))}
            >
              {current.external
                ? current.installing
                  ? 'Installation en cours…'
                  : `Installer ${current.title}`
                : '1. Ouvrir la page de téléchargement'}
            </button>
            {!current.external && (
              <button disabled={busy} onClick={() => void install(current)}>
                2. Choisir {current.fileHint}…
              </button>
            )}
          </div>
        )}
        {current?.installError && !current.installing && <p className="settings-note warn">{current.installError}</p>}
        {message && <p className="settings-note">{message}</p>}
      </div>
    </Screen>
  )
}
