import { useEffect, useMemo, useRef, useState } from 'react'
import type { CharacterSeries, Config, Profile, ProfileArt } from '../../../shared/types'
import { useMoveSound } from '../audio/useSound'
import Avatar from '../components/Avatar'
import { BACKGROUNDS, backgroundId } from '../components/backgrounds'
import Screen from '../components/Screen'
import { useInput } from '../hooks/useInput'

const COLUMNS = 6

interface Props {
  config: Config
  profileId: string
  /** Images actuelles du profil (pour l'aperçu tant que rien n'a changé). */
  art?: ProfileArt
  onSave: (patch: Pick<Profile, 'avatar' | 'image' | 'background' | 'color'>) => void
  onBack: () => void
}

type Tab = 'character' | 'background'

type Entry =
  | { kind: 'file'; id: string; label: string; thumb: string }
  | { kind: 'pick'; id: string; label: string }
  | { kind: 'bg'; id: string; label: string }

/**
 * « Modifier l'icône », comme sur la console : un personnage, puis l'arrière-plan. Deux onglets,
 * un aperçu en direct, « Valider » pour enregistrer et B pour annuler sans rien changer.
 */
export default function EditIconScreen({ config, profileId, art, onSave, onBack }: Props): JSX.Element {
  const profile = config.profiles.find((p) => p.id === profileId) ?? config.profiles[0]
  const [tab, setTab] = useState<Tab>('character')
  const [avatar, setAvatar] = useState(profile.avatar)
  const [image, setImage] = useState(profile.image)
  const [background, setBackground] = useState(backgroundId(profile))
  const [series, setSeries] = useState<CharacterSeries[]>([])
  const [pickedPreview, setPickedPreview] = useState<string | null>(null)
  const [sel, setSel] = useState(0)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.api.listCharacters().then(setSeries)
  }, [])

  // Sections de l'onglet « Personnage » : mes créatures, les séries de l'utilisateur, puis « Mon image ».
  const sections = useMemo(() => {
    const result: { title: string; entries: Entry[] }[] = []
    for (const s of series) {
      result.push({
        title: s.name || 'Mes personnages',
        entries: s.items.map((i) => ({ kind: 'file' as const, id: i.id, label: i.name, thumb: i.thumb }))
      })
    }
    result.push({ title: 'Mon image', entries: [{ kind: 'pick', id: 'pick', label: 'Choisir une image…' }] })
    return result
  }, [series])

  const backgroundEntries: Entry[] = BACKGROUNDS.map((b) => ({ kind: 'bg', id: b.id, label: b.label }))
  const flat: Entry[] = tab === 'character' ? sections.flatMap((s) => s.entries) : backgroundEntries

  const isChosen = (e: Entry): boolean =>
    e.kind === 'bg' ? e.id === background : e.kind === 'pick' ? Boolean(image) : !image && e.id === avatar

  // Au changement d'onglet, la sélection se place sur le choix actuel.
  useEffect(() => {
    const at = flat.findIndex(isChosen)
    setSel(at >= 0 ? at : 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])
  useMoveSound(`${tab}:${sel}`)

  useEffect(() => {
    bodyRef.current?.querySelector('.icon-btn.focused')?.scrollIntoView({ block: 'nearest' })
  }, [sel, tab, series])

  const choose = async (e: Entry): Promise<void> => {
    if (e.kind === 'bg') setBackground(e.id)
    else if (e.kind === 'pick') {
      const file = await window.api.pickImage()
      if (file) {
        setImage(file)
        setPickedPreview(await window.api.previewImage(file))
      }
    } else {
      setAvatar(e.id)
      setImage('')
    }
  }

  const save = (): void => {
    const solid = /^c:(#[0-9a-f]{6})$/i.exec(background)
    onSave({ avatar, image, background, color: solid ? solid[1] : profile.color })
  }

  useInput((action) => {
    const max = flat.length - 1
    if (action === 'back') onBack()
    else if (action === 'menu') save()
    else if (action === 'nextTab') setTab('background')
    else if (action === 'prevTab') setTab('character')
    else if (action === 'left') setSel((s) => Math.max(0, s - 1))
    else if (action === 'right') setSel((s) => Math.min(max, s + 1))
    else if (action === 'up') setSel((s) => (s - COLUMNS >= 0 ? s - COLUMNS : s))
    else if (action === 'down') setSel((s) => (s + COLUMNS <= max ? s + COLUMNS : s))
    else if (action === 'confirm' && flat[sel]) void choose(flat[sel])
  })

  // Aperçu : ce qui est choisi en ce moment, pas encore enregistré.
  const draft: Profile = { ...profile, avatar, image, background }
  const draftArt: ProfileArt | undefined = image
    ? { image: pickedPreview ?? (image === profile.image ? art?.image : undefined) }
    : avatar.startsWith('file:')
      ? { character: series.flatMap((s) => s.items).find((i) => i.id === avatar)?.thumb ?? art?.character }
      : undefined

  let index = -1
  const renderEntry = (e: Entry): JSX.Element => {
    index += 1
    const i = index
    const focused = sel === i
    const chosen = isChosen(e)
    const cls = `icon-btn${focused ? ' focused' : ''}${chosen ? ' chosen' : ''}`
    if (e.kind === 'bg') {
      const bg = BACKGROUNDS.find((b) => b.id === e.id)
      return (
        <button key={e.id} className={`${cls} bg-btn`} style={bg?.style} title={e.label} aria-label={e.label} onMouseEnter={() => setSel(i)} onClick={() => void choose(e)} />
      )
    }
    return (
      <button
        key={e.id}
        className={`${cls}${e.kind === 'pick' ? ' pick-btn' : ''}`}
        title={e.label}
        aria-label={e.label}
        onMouseEnter={() => setSel(i)}
        onClick={() => void choose(e)}
      >
        {e.kind === 'file' ? (
          <span className="icon-art" style={{ background: 'var(--slot)' }}>
            <img src={e.thumb} alt="" draggable={false} />
          </span>
        ) : (
          <span className="icon-pick">Choisir une image…</span>
        )}
      </button>
    )
  }

  return (
    <Screen
      title="Modifier l’icône"
      onBack={onBack}
      hints={[
        { key: 'L R', label: 'Onglet' },
        { key: 'A', label: 'Choisir' },
        { key: '+', label: 'Valider' }
      ]}
    >
      <div className="editicon">
        <aside className="editicon-preview">
          <div className="mypage-avatar">
            <Avatar profile={draft} art={draftArt} />
          </div>
          <h2 className="mypage-name">{profile.name}</h2>
          <button className="btn primary-btn" onClick={save}>
            Valider
          </button>
        </aside>

        <section className="editicon-main">
          <div className="tabs" role="tablist">
            <button className={`tab${tab === 'character' ? ' on' : ''}`} role="tab" aria-selected={tab === 'character'} onClick={() => setTab('character')}>
              Personnage
            </button>
            <button className={`tab${tab === 'background' ? ' on' : ''}`} role="tab" aria-selected={tab === 'background'} onClick={() => setTab('background')}>
              Arrière-plan
            </button>
          </div>

          <div className="editicon-body" ref={bodyRef}>
            {tab === 'character' ? (
              sections.map((s) => (
                <div className="series" key={s.title}>
                  <h3>{s.title}</h3>
                  <div className="icon-grid">{s.entries.map(renderEntry)}</div>
                </div>
              ))
            ) : (
              <div className="icon-grid bg-grid">{backgroundEntries.map(renderEntry)}</div>
            )}
          </div>
        </section>
      </div>
    </Screen>
  )
}
