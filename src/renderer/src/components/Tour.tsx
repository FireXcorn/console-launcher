import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { engine } from '../audio/engine'
import { useInput } from '../hooks/useInput'

interface Step {
  /** Sélecteur CSS de l'élément montré ; sans lui (ou introuvable), la bulle est au centre. */
  target?: string
  title: string
  text: string
}

const STEPS: Step[] = [
  {
    target: '.tile.missing',
    title: 'Ici, il manque ta cartouche',
    text: 'Un jeu « Cartouche vide » n’a pas encore son fichier. Sélectionne-le et appuie sur A : une fenêtre s’ouvre, tu y choisis ton fichier de jeu (.nup) ou ta ROM, et le lanceur prépare tout seul le jeu.'
  },
  {
    title: 'Zelda déjà construit ?',
    text: 'Tu as déjà construit Zelda Ocarina of Time avec ReLink, Longshot ou Hookshot ? Pas besoin de recommencer : sélectionne la tuile Zelda, appuie sur A et indique le dossier de ton jeu (celui qui contient le dossier « bin »).'
  },
  {
    target: '.topbar .avatar',
    title: 'Ton profil',
    text: 'En haut à gauche : ton profil. Chaque profil a ses propres sauvegardes de jeu, comme sur la console.'
  },
  {
    target: '.dock-item[aria-label*="Paramètres"], .dock-item:nth-last-child(2)',
    title: 'Ajouter des jeux',
    text: 'Dans Paramètres → Ajouter des jeux, trois cartes : « Jeux rétro » (tes ROM Game Boy, GBA, DS, 3DS), « Jeu de mon PC » (Fortnite, Steam, Epic… choisis-le dans la liste de tes jeux installés) et « Jeu Switch 2 » (ton fichier .nup). Le lanceur t’explique quoi apporter et ajoute le jeu tout de suite.'
  },
  {
    target: '.tile[data-collection="pokemon"]',
    title: 'La tuile Pokémon',
    text: 'Tous tes jeux Pokémon sont rangés dans cette tuile : appuie sur A dessus pour les voir par console. Dedans, le bouton « Ajouter mes jeux » ouvre le même assistant. Tu peux aussi glisser tes fichiers de jeu sur la fenêtre du lanceur : ils sont rangés tout seuls.'
  },
  {
    title: 'Pour jouer',
    text: 'Quand le jeu est prêt, sa tuile n’est plus « Cartouche vide » : sélectionne-la, appuie sur A, et le jeu se lance en plein écran.'
  },
  {
    title: 'Pour quitter un jeu',
    text: 'Appuie sur Ctrl+Alt+Q, ou maintiens Retour et Menu pendant 2 secondes sur la manette : tu reviens au menu.'
  }
]

interface Props {
  /** Appelé à la fin de la visite ou quand on la passe. */
  onDone: () => void
}

interface Placement {
  left: number
  top: number
  arrow: 'top' | 'bottom' | null
  arrowX: number
}

const MARGIN = 16
const GAP = 22

/**
 * Visite guidée du premier lancement : une bulle avec une flèche vers l'élément expliqué, le reste de l'écran
 * assombri. A (ou Entrée) passe à l'étape suivante, B (ou Échap) quitte la visite.
 */
export default function Tour({ onDone }: Props): JSX.Element {
  const [index, setIndex] = useState(0)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState<Placement | null>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)

  // Les étapes dont l'élément n'existe pas (ex. aucune tuile vide) sont gardées : la bulle passe au centre.
  const step = STEPS[index]
  const last = index === STEPS.length - 1

  const finish = (): void => {
    engine.play('retour')
    onDone()
  }
  const next = (): void => {
    if (last) onDone()
    else setIndex((i) => i + 1)
    engine.play('valider')
  }

  useInput((action, source) => {
    if (action === 'confirm') next()
    // Manette : Retour revient d'une étape (un bouton pris pour un autre ne doit pas fermer la visite) ; Échap la quitte.
    else if (action === 'back') {
      if (source === 'key') finish()
      else setIndex((i) => Math.max(0, i - 1))
    }
  })

  const stepKey = useMemo(() => index, [index])
  useLayoutEffect(() => {
    const el = step.target ? document.querySelector<HTMLElement>(step.target) : null
    const r = el ? el.getBoundingClientRect() : null
    const b = bubbleRef.current
    setRect(r && r.width > 0 ? r : null)
    if (!b) return
    const w = b.offsetWidth
    const h = b.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight
    if (!r || r.width === 0) {
      setPlace({ left: (vw - w) / 2, top: (vh - h) / 2, arrow: null, arrowX: 0 })
      return
    }
    const cx = r.left + r.width / 2
    const left = Math.min(Math.max(cx - w / 2, MARGIN), vw - w - MARGIN)
    const above = r.top - GAP - h >= MARGIN
    const top = above ? r.top - GAP - h : Math.min(r.bottom + GAP, vh - h - MARGIN)
    setPlace({ left, top, arrow: above ? 'bottom' : 'top', arrowX: Math.min(Math.max(cx - left, 28), w - 28) })
  }, [stepKey, step.target])

  return (
    <div className="tour" role="dialog" aria-label="Visite guidée">
      {rect ? (
        <div
          className="tour-spot"
          style={{ left: rect.left - 8, top: rect.top - 8, width: rect.width + 16, height: rect.height + 16 }}
        />
      ) : (
        <div className="tour-dim" />
      )}
      <div
        ref={bubbleRef}
        className="tour-bubble"
        style={{ left: place?.left ?? 0, top: place?.top ?? 0, visibility: place ? 'visible' : 'hidden' }}
      >
        {place?.arrow && <span className={`tour-arrow ${place.arrow}`} style={{ left: place.arrowX }} />}
        <div className="tour-count">
          Étape {index + 1} sur {STEPS.length}
        </div>
        <h3>{step.title}</h3>
        <p>{step.text}</p>
        <div className="tour-foot">
          <button className="tour-skip" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={finish}>
            Passer la visite
          </button>
          <button className="primary" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={next}>
            {last ? 'A  Terminer' : 'A  Suivant'}
          </button>
        </div>
      </div>
    </div>
  )
}
