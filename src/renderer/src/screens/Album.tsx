import { useCallback, useEffect, useRef, useState } from 'react'
import type { AlbumItem, Config } from '../../../shared/types'
import ConfirmDialog from '../components/ConfirmDialog'
import { useMoveSound } from '../audio/useSound'
import Screen from '../components/Screen'
import { useInput } from '../hooks/useInput'

const COLUMNS = 4
const thumbCache = new Map<string, string | null>()

function Thumb({ path }: { path: string }): JSX.Element {
  const [src, setSrc] = useState<string | null | undefined>(thumbCache.get(path))
  useEffect(() => {
    if (thumbCache.has(path)) return
    let alive = true
    window.api.albumThumb(path).then((t) => {
      thumbCache.set(path, t)
      if (alive) setSrc(t)
    })
    return () => {
      alive = false
    }
  }, [path])
  return src ? <img src={src} alt="" draggable={false} /> : <div className="thumb-wait" />
}

function Viewer({ item, count, index }: { item: AlbumItem; count: number; index: number }): JSX.Element {
  const [src, setSrc] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    setSrc(undefined)
    window.api.albumImage(item.path).then((s) => alive && setSrc(s))
    return () => {
      alive = false
    }
  }, [item.path])
  return (
    <div className="viewer">
      {src ? <img src={src} alt={item.name} draggable={false} /> : <p>{src === null ? 'Image illisible' : 'Chargement…'}</p>}
      <div className="viewer-bar">
        <span>{item.name}</span>
        <span>
          {index + 1} / {count}
        </span>
      </div>
    </div>
  )
}

export default function AlbumScreen({ config, onBack }: { config: Config; onBack: () => void }): JSX.Element {
  const [items, setItems] = useState<AlbumItem[] | null>(null)
  const [sel, setSel] = useState(0)
  const [viewing, setViewing] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const count = items?.length ?? 0

  const load = useCallback(async () => setItems(await window.api.listAlbum()), [])
  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    gridRef.current?.querySelector('.album-tile.focused')?.scrollIntoView({ block: 'nearest' })
  }, [sel, items])

  useInput((action) => {
    if (viewing !== null) {
      if (action === 'back') setViewing(null)
      else if (action === 'left') setViewing((v) => Math.max(0, (v ?? 0) - 1))
      else if (action === 'right') setViewing((v) => Math.min(count - 1, (v ?? 0) + 1))
      else if (action === 'option') setDeleting(viewing)
      return
    }
    if (action === 'back') return onBack()
    if (count === 0) return
    if (action === 'left') setSel((s) => Math.max(0, s - 1))
    else if (action === 'right') setSel((s) => Math.min(count - 1, s + 1))
    else if (action === 'up') setSel((s) => (s - COLUMNS >= 0 ? s - COLUMNS : s))
    else if (action === 'down') setSel((s) => (s + COLUMNS < count ? s + COLUMNS : s))
    else if (action === 'confirm') setViewing(sel)
    else if (action === 'option') setDeleting(sel)
  })

  // Garde la sélection dans la liste, et ferme la visionneuse si la liste se vide.
  useEffect(() => {
    setSel((s) => Math.min(s, Math.max(0, count - 1)))
    setViewing((v) => (v !== null && v >= count ? (count > 0 ? count - 1 : null) : v))
  }, [count])

  const remove = async (): Promise<void> => {
    const item = deleting !== null ? items?.[deleting] : undefined
    setDeleting(null)
    if (!item) return
    if (await window.api.deleteAlbumItem(item.path)) {
      thumbCache.delete(item.path)
      await load()
    }
  }

  const current = viewing !== null ? items?.[viewing] : undefined
  useMoveSound(viewing ?? `grille:${sel}`)

  return (
    <Screen
      title="Album"
      onBack={onBack}
      hints={[
        { key: 'A', label: viewing === null ? 'Afficher' : 'Suivante' },
        { key: 'Y', label: 'Supprimer' }
      ]}
    >
      {items === null ? (
        <p className="screen-note">Chargement…</p>
      ) : count === 0 ? (
        <div className="screen-empty">
          <h2>Aucune capture</h2>
          <p>
            Pendant un jeu, appuie sur <kbd>{config.captureKey || 'F12'}</kbd> pour enregistrer une capture d’écran.
          </p>
          <small>Dossier : {config.albumDir}</small>
        </div>
      ) : (
        <div className="album-grid" ref={gridRef}>
          {items.map((item, i) => (
            <div
              key={item.path}
              className={`album-tile${sel === i ? ' focused' : ''}`}
              onMouseEnter={() => setSel(i)}
              onClick={() => {
                setSel(i)
                setViewing(i)
              }}
            >
              <Thumb path={item.path} />
              <span className="album-date">
                {new Date(item.modified).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </span>
            </div>
          ))}
        </div>
      )}

      {current && viewing !== null && <Viewer item={current} count={count} index={viewing} />}

      {deleting !== null && items?.[deleting] && (
        <ConfirmDialog
          title="Supprimer cette capture ?"
          message={`« ${items[deleting].name} » sera envoyée à la corbeille.`}
          confirmLabel="Supprimer"
          onCancel={() => setDeleting(null)}
          onConfirm={remove}
        />
      )}
    </Screen>
  )
}
