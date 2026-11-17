import { useEffect, useMemo, useRef, useState } from 'react'
import type { AddRomsSummary, Config, EmulatedGame, ProgramCandidate } from '../../../shared/types'
import { useInput } from '../hooks/useInput'
import { CardIcon, PadIcon, PcIcon } from './icons'
import { useRecipes } from './RecipeCard'

export type AddKind = 'retro' | 'pc' | 'switch'

/** Les trois façons d'ajouter un jeu : mêmes cartes à l'accueil, dans les paramètres et dans l'assistant. */
export const ADD_KINDS: { id: AddKind; title: string; text: string; icon: JSX.Element }[] = [
  { id: 'retro', title: 'Jeux rétro', text: 'Game Boy, GBA, DS, 3DS : tes fichiers de jeu (ROM).', icon: <PadIcon /> },
  { id: 'pc', title: 'Jeu de mon PC', text: 'Fortnite, jeux Steam, Epic… déjà installés.', icon: <PcIcon /> },
  { id: 'switch', title: 'Jeu Switch 2', text: 'Mario Kart World… avec ton fichier de jeu.', icon: <CardIcon /> }
]

/** Rangée des trois cartes ; `focused` : carte sélectionnée à la manette (-1 : aucune). */
export function AddCards({ focused, onHover, onPick }: { focused: number; onHover?: (i: number) => void; onPick: (kind: AddKind) => void }): JSX.Element {
  return (
    <div className="add-cards">
      {ADD_KINDS.map((k, i) => (
        <button key={k.id} className={`add-card${focused === i ? ' focused' : ''}`} onMouseEnter={() => onHover?.(i)} onClick={() => onPick(k.id)}>
          <span className="add-card-icon">{k.icon}</span>
          <strong>{k.title}</strong>
          <small>{k.text}</small>
        </button>
      ))}
    </div>
  )
}

interface Props {
  /** Type choisi d'avance ; sans lui, l'assistant commence par les trois cartes. */
  start?: AddKind
  config: Config
  /** Résultat d'un glisser-déposer fait pendant que l'assistant est ouvert. */
  dropped: AddRomsSummary | null
  /** Enregistre les réglages et relit la bibliothèque. */
  onSave: (patch: Partial<Config>) => Promise<void>
  onRescan: () => Promise<unknown>
  /** Ouvre la fenêtre « Il manque ta cartouche » d'un jeu Switch 2. */
  onRecipe: (recipeId: string, title: string) => void
  /** `added` : au moins un jeu a été ajouté. */
  onClose: (added: boolean) => void
}

const titleFromPath = (path: string): string => (path.split(/[\\/]/).pop() ?? path).replace(/\.[^.]+$/, '').replace(/[_.]+/g, ' ').trim()

/**
 * Assistant « Ajouter un jeu » : on choisit le type de jeu, puis il explique quoi apporter et fait l'ajout.
 * Tout est enregistré tout de suite. A valide, B revient en arrière.
 */
export default function AddGame({ start, config, dropped, onSave, onRescan, onRecipe, onClose }: Props): JSX.Element {
  const [kind, setKind] = useState<AddKind | null>(start ?? null)
  const [index, setIndex] = useState(0)
  const [added, setAdded] = useState(false)
  const [busy, setBusy] = useState(false)
  // Jeux rétro
  const [result, setResult] = useState<AddRomsSummary | null>(null)
  // Jeu PC
  const [apps, setApps] = useState<ProgramCandidate[] | null>(null)
  const [query, setQuery] = useState('')
  const [done, setDone] = useState('')
  const [note, setNote] = useState('')
  const { recipes } = useRecipes()
  const focusedRef = useRef<HTMLButtonElement | null>(null)

  const pick = (k: AddKind | null): void => {
    setKind(k)
    setIndex(0)
    setResult(null)
    setDone('')
    setNote('')
  }

  useEffect(() => {
    if (kind === 'pc' && apps === null) void window.api.installedGames().then(setApps)
  }, [kind, apps])

  useEffect(() => {
    if (!dropped) return
    setKind('retro')
    setIndex(0)
    setResult(dropped)
    if (dropped.added.length) setAdded(true)
  }, [dropped])

  useEffect(() => {
    focusedRef.current?.scrollIntoView({ block: 'nearest' })
  }, [index, query])

  const chooseRoms = async (): Promise<void> => {
    const r = await window.api.addRoms()
    if (!r) return
    await onRescan()
    setResult(r)
    setIndex(0)
    if (r.added.length) setAdded(true)
  }

  const addPrograms = async (list: ProgramCandidate[]): Promise<number> => {
    const same = (e: EmulatedGame, c: ProgramCandidate): boolean =>
      e.emulatorExe.toLowerCase() === c.exe.toLowerCase() && e.args.join(' ') === (c.args ?? []).join(' ')
    const fresh = list.filter((c) => !config.emulated.some((e) => same(e, c)))
    if (fresh.length === 0) return 0
    setBusy(true)
    await onSave({ emulated: [...config.emulated, ...fresh.map((c) => ({ title: c.title, emulatorExe: c.exe, gameFile: '', args: c.args ?? [], readyTitle: '', ...(c.icon ? { iconFrom: c.icon } : {}) }))] })
    setBusy(false)
    setAdded(true)
    return fresh.length
  }

  const addOne = async (c: ProgramCandidate): Promise<void> => {
    const n = await addPrograms([c])
    setNote(n ? '' : `${c.title} est déjà dans tes jeux.`)
    if (n) {
      setDone(`${c.title} est sur ton accueil.`)
      setIndex(0)
    }
  }
  const pickExe = async (): Promise<void> => {
    const exe = await window.api.pickFile(true)
    if (exe) await addOne({ title: titleFromPath(exe), exe })
  }
  const importFolder = async (): Promise<void> => {
    const dir = await window.api.pickFolder()
    if (!dir) return
    const n = await addPrograms(await window.api.findPrograms(dir))
    if (n) {
      setDone(n === 1 ? '1 jeu ajouté sur ton accueil.' : `${n} jeux ajoutés sur ton accueil.`)
      setIndex(0)
    } else setNote('Aucun nouveau jeu trouvé dans ce dossier (le lanceur cherche un programme .exe par sous-dossier).')
  }

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (apps ?? []).filter((a) => !q || a.title.toLowerCase().includes(q))
  }, [apps, query])
  const pending = recipes.filter((r) => r.state !== 'ready')

  // Ce que A valide dans l'étape en cours, dans l'ordre de la sélection.
  const actions: (() => void)[] =
    kind === null
      ? ADD_KINDS.map((k) => () => pick(k.id))
      : kind === 'retro'
        ? result
          ? [() => onClose(added), () => pick('retro')]
          : [() => void chooseRoms()]
        : kind === 'pc'
          ? done
            ? [() => onClose(added), () => pick('pc')]
            : [...shown.map((a) => () => void addOne(a)), () => void pickExe(), () => void importFolder()]
          : pending.map((r) => () => onRecipe(r.id, r.title))

  const goBack = (): void => (kind === null || start ? onClose(added) : pick(null))

  useInput((action) => {
    const max = Math.max(0, actions.length - 1)
    if (action === 'back') goBack()
    else if (action === 'left' || action === 'up') setIndex((i) => Math.max(0, i - 1))
    else if (action === 'right' || action === 'down') setIndex((i) => Math.min(max, i + 1))
    else if (action === 'confirm' && !busy) actions[Math.min(index, max)]?.()
  })

  const item = (i: number, label: JSX.Element | string, cls = ''): JSX.Element => (
    <button
      key={i}
      ref={index === i ? focusedRef : undefined}
      className={`${cls}${index === i ? ' focused' : ''}`.trim()}
      disabled={busy}
      onMouseEnter={() => setIndex(i)}
      onClick={() => actions[i]?.()}
    >
      {label}
    </button>
  )

  const heading = kind === null ? 'Ajouter un jeu' : kind === 'retro' ? 'Ajouter des jeux rétro' : kind === 'pc' ? 'Ajouter un jeu de mon PC' : 'Ajouter un jeu Switch 2'

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose(added)}>
      <div className="dialog add-game" role="dialog" aria-label={heading}>
        <h2>{heading}</h2>

        {kind === null && (
          <>
            <p>Quel jeu veux-tu ajouter ?</p>
            <AddCards focused={index} onHover={setIndex} onPick={pick} />
          </>
        )}

        {kind === 'retro' && !result && (
          <>
            <ol className="add-steps">
              <li>
                <strong>Prends tes fichiers de jeu.</strong>
                <table className="add-formats">
                  <tbody>
                    <tr><td>.gb .gbc .gba</td><td>Game Boy, Game Boy Color, Game Boy Advance</td></tr>
                    <tr><td>.nds</td><td>Nintendo DS</td></tr>
                    <tr><td>.3ds .cci .cxi</td><td>Nintendo 3DS</td></tr>
                  </tbody>
                </table>
                <small>Un fichier compressé (.zip, .7z) doit d’abord être décompressé.</small>
              </li>
              <li>
                <strong>Donne-les au lanceur.</strong> Il les range et choisit le bon émulateur : rien à installer.
              </li>
            </ol>
            <div className="add-drop">
              <span>Glisse tes fichiers sur cette fenêtre, ou</span>
              {item(0, 'Choisir mes fichiers…', 'primary')}
            </div>
            <small className="app-note">N’utilise que les jeux que tu possèdes. Les titres Pokémon sont reconnus par le nom du fichier.</small>
          </>
        )}

        {kind === 'retro' && result && (
          <>
            <ul className="add-result">
              {result.added.map((t) => (
                <li key={t} className="ok">✔ {t} <small>ajouté</small></li>
              ))}
              {result.skipped.map((t) => (
                <li key={t} className="no">✖ {t}</li>
              ))}
            </ul>
            {result.added.length > 0 && <p>Tes jeux Pokémon sont dans la tuile « Pokémon » de l’accueil ; les autres sont directement sur l’accueil.</p>}
            <div className="dialog-actions">
              {item(0, 'Terminé', 'primary')}
              {item(1, 'En ajouter d’autres')}
            </div>
          </>
        )}

        {kind === 'pc' && !done && (
          <>
            <p>Les jeux détectés sur ton ordinateur (Microsoft Store, Xbox, Steam, Epic) :</p>
            <input className="add-search" data-native-input placeholder="Rechercher (ex. Fortnite)…" value={query} onChange={(e) => { setQuery(e.target.value); setIndex(0) }} />
            <div className="add-list">
              {apps === null && <p className="settings-note">Recherche des jeux installés…</p>}
              {apps !== null && shown.length === 0 && (
                <p className="settings-note">
                  {apps.length === 0 ? 'Aucun jeu détecté (Microsoft Store, Xbox, Steam, Epic). Pour un autre jeu, choisis son programme ou son dossier ci-dessous.' : 'Aucun jeu installé ne porte ce nom.'}
                </p>
              )}
              {shown.map((a, i) => item(i, a.title, 'add-item'))}
            </div>
            <p className="settings-note">Il n’est pas dans la liste ?</p>
            <div className="field-row wrap">
              {item(shown.length, 'Choisir son programme (.exe)…')}
              {item(shown.length + 1, 'Importer tout un dossier de jeux…')}
            </div>
            {note && <p className="settings-note">{note}</p>}
          </>
        )}

        {kind === 'pc' && done && (
          <>
            <ul className="add-result">
              <li className="ok">✔ {done}</li>
            </ul>
            <p>Pour changer son nom ou son image : sélectionne sa tuile sur l’accueil et appuie sur +.</p>
            <div className="dialog-actions">
              {item(0, 'Terminé', 'primary')}
              {item(1, 'Ajouter un autre jeu')}
            </div>
          </>
        )}

        {kind === 'switch' && (
          <>
            <p>Ces jeux sont livrés avec leur outil. Il manque seulement ta cartouche : ton propre fichier de jeu. Choisis un jeu, le lanceur te guide.</p>
            <div className="add-list">
              {pending.length === 0 && (
                <p className="settings-note">
                  {recipes.length === 0 ? 'Les jeux Switch 2 ne sont disponibles que sous Windows pour l’instant.' : 'Tous les jeux Switch 2 livrés sont déjà prêts.'}
                </p>
              )}
              {pending.map((r, i) => item(i, r.title, 'add-item'))}
            </div>
          </>
        )}

        {!(kind === 'retro' && result) && !(kind === 'pc' && done) && (
          <div className="dialog-actions add-foot">
            <button onClick={goBack}>{kind === null || start ? 'Fermer' : '← Retour'}</button>
          </div>
        )}
      </div>
    </div>
  )
}
