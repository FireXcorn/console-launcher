import { useRef, useState } from 'react'
import { useMoveSound } from '../audio/useSound'
import { useInput } from '../hooks/useInput'

/** « + Ajouter une appli » : un nom, puis un programme de l'ordinateur OU l'adresse d'un site, et une image si on veut. */
export default function AddCustomApp({ onDone }: { onDone: (added: boolean) => void }): JSX.Element {
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [program, setProgram] = useState('')
  const [image, setImage] = useState('')
  const [index, setIndex] = useState(0)
  const [error, setError] = useState('')
  const inputs = useRef<Record<string, HTMLInputElement | null>>({})
  useMoveSound(index)

  const name = (path: string): string => path.split(/[\\/]/).pop() ?? path
  const rows = [
    { id: 'title', label: 'Nom' },
    { id: 'url', label: 'Adresse du site (https://…)' },
    { id: 'program', label: program ? `Programme : ${name(program)}` : '… ou choisir un programme' },
    { id: 'image', label: image ? `Image : ${name(image)}` : 'Choisir une image (facultatif)' },
    { id: 'add', label: 'Ajouter' },
    { id: 'cancel', label: 'Annuler' }
  ]

  const add = async (): Promise<void> => {
    const err = await window.api.addCustomApp(title, program || url.trim(), image)
    if (err) setError(err)
    else onDone(true)
  }

  const run = (id: string): void => {
    if (id === 'title' || id === 'url') inputs.current[id]?.focus()
    else if (id === 'program')
      void window.api.pickFile(true).then((f) => {
        if (f) {
          setProgram(f)
          setUrl('')
          if (!title.trim()) setTitle(name(f).replace(/\.[^.]+$/, ''))
        }
      })
    else if (id === 'image') void window.api.pickImage().then((f) => f && setImage(f))
    else if (id === 'add') void add()
    else onDone(false)
  }

  useInput((action) => {
    if (action === 'up') setIndex((i) => Math.max(0, i - 1))
    else if (action === 'down') setIndex((i) => Math.min(rows.length - 1, i + 1))
    else if (action === 'confirm') run(rows[index].id)
    else if (action === 'back') onDone(false)
  })

  const field = (id: 'title' | 'url', value: string, set: (v: string) => void): JSX.Element => (
    <input
      ref={(el) => {
        inputs.current[id] = el
      }}
      value={value}
      maxLength={id === 'title' ? 40 : 1000}
      placeholder={id === 'url' ? 'https://…' : 'Ex. Netflix'}
      onChange={(e) => set(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.stopPropagation()
          e.currentTarget.blur()
        }
      }}
    />
  )

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onDone(false)}>
      <div className="panel" role="dialog" aria-label="Ajouter une appli" data-native-input>
        <h2>Ajouter une appli</h2>
        <p className="panel-sub">Un site s’ouvre dans le lanceur (F4 pour revenir) ; un programme s’ouvre à part.</p>
        <ul className="menu-list">
          {rows.map((r, i) => (
            <li key={r.id}>
              {r.id === 'title' || r.id === 'url' ? (
                <label className={`menu-row title-edit${index === i ? ' focused' : ''}`} onMouseEnter={() => setIndex(i)}>
                  <span>{r.label}</span>
                  {r.id === 'title'
                    ? field('title', title, setTitle)
                    : field('url', url, (v) => {
                        setUrl(v)
                        setProgram('')
                      })}
                </label>
              ) : (
                <button className={`menu-row${index === i ? ' focused' : ''}`} onMouseEnter={() => setIndex(i)} onClick={() => run(r.id)}>
                  <span>{r.label}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
        {error && <p className="panel-sub">{error}</p>}
      </div>
    </div>
  )
}
