import { useCallback, useEffect, useRef, useState } from 'react'
import type { NewsResult } from '../../../shared/types'
import { useMoveSound } from '../audio/useSound'
import Screen from '../components/Screen'
import { useInput } from '../hooks/useInput'

const dateFormat = (ms: number): string =>
  ms ? new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''

export default function NewsScreen({ onBack }: { onBack: () => void }): JSX.Element {
  const [result, setResult] = useState<NewsResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  const load = useCallback(async (force: boolean) => {
    setLoading(true)
    setResult(await window.api.fetchNews(force))
    setLoading(false)
  }, [])
  useEffect(() => {
    load(false)
  }, [load])

  const items = result?.items ?? []
  const current = items[sel]
  useMoveSound(sel)

  useEffect(() => {
    listRef.current?.querySelector('.news-row.focused')?.scrollIntoView({ block: 'nearest' })
  }, [sel, items.length])

  const open = (i: number): void => {
    const item = items[i]
    if (item) window.api.openExternal(item.link)
  }

  useInput((action) => {
    if (action === 'back') onBack()
    else if (action === 'option') load(true)
    else if (action === 'up') setSel((s) => Math.max(0, s - 1))
    else if (action === 'down') setSel((s) => Math.min(items.length - 1, s + 1))
    else if (action === 'confirm') open(sel)
  })

  return (
    <Screen
      title="Actualités"
      onBack={onBack}
      hints={[
        { key: 'A', label: 'Ouvrir l’article' },
        { key: 'Y', label: 'Actualiser' }
      ]}
    >
      {loading && items.length === 0 ? (
        <p className="screen-note">Chargement des actualités…</p>
      ) : items.length === 0 ? (
        <div className="screen-empty">
          <h2>Aucune actualité</h2>
          <p>{result?.error ?? 'Le flux est vide.'}</p>
          <small>Vérifie ta connexion ou l’adresse du flux dans les réglages.</small>
        </div>
      ) : (
        <div className="news">
          <ul className="news-list" ref={listRef}>
            {items.map((item, i) => (
              <li key={item.link}>
                <button
                  className={`news-row${sel === i ? ' focused' : ''}`}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => open(i)}
                >
                  <span className="news-title">{item.title}</span>
                  <small>{dateFormat(item.date)}</small>
                </button>
              </li>
            ))}
          </ul>
          <article className="news-detail">
            {result?.stale && (
              <p className="news-warning">
                Hors ligne : dernières actualités enregistrées ({dateFormat(result.fetchedAt)}).
              </p>
            )}
            {current && (
              <>
                <h2>{current.title}</h2>
                <small>{dateFormat(current.date)}</small>
                {current.summary && <p>{current.summary}</p>}
                <small className="news-link">{new URL(current.link).hostname}</small>
              </>
            )}
          </article>
        </div>
      )}
    </Screen>
  )
}
