import type { CSSProperties } from 'react'
import type { Profile } from '../../../shared/types'
import { PROFILE_COLORS } from './colors'

export interface Background {
  id: string
  label: string
  style: CSSProperties
}

const WHITE = 'rgba(255, 255, 255, 0.32)'

/** Arrière-plans proposés : couleurs unies, dégradés et motifs (tous dessinés en CSS, donc nets à toute taille). */
export const BACKGROUNDS: Background[] = [
  ...PROFILE_COLORS.map((hex) => ({ id: `c:${hex}`, label: 'Uni', style: { background: hex } })),
  { id: 'g:aube', label: 'Aube', style: { background: 'linear-gradient(135deg, #f6d365, #fda085)' } },
  { id: 'g:ocean', label: 'Océan', style: { background: 'linear-gradient(135deg, #5fe3ff, #2f6fe0)' } },
  { id: 'g:foret', label: 'Forêt', style: { background: 'linear-gradient(135deg, #b4e06a, #2bb3a4)' } },
  { id: 'g:nuit', label: 'Nuit', style: { background: 'linear-gradient(160deg, #5b5fd6, #2d3340)' } },
  { id: 'g:bonbon', label: 'Bonbon', style: { background: 'linear-gradient(135deg, #f0728a, #8a4fd6)' } },
  { id: 'g:braise', label: 'Braise', style: { background: 'linear-gradient(135deg, #f2b632, #e0252b)' } },
  {
    id: 'p:pois',
    label: 'Pois',
    style: { background: `radial-gradient(circle, ${WHITE} 20%, transparent 22%) 0 0 / 24% 24%, #f0728a` }
  },
  {
    id: 'p:rayures',
    label: 'Rayures',
    style: { background: `repeating-linear-gradient(45deg, ${WHITE} 0 10%, transparent 10% 20%), #2bb3c8` }
  },
  {
    id: 'p:rayons',
    label: 'Rayons',
    style: { background: `repeating-conic-gradient(${WHITE} 0 10deg, transparent 10deg 20deg), #8a4fd6` }
  },
  {
    id: 'p:damier',
    label: 'Damier',
    style: {
      background: `conic-gradient(${WHITE} 25%, transparent 0 50%, ${WHITE} 0 75%, transparent 0) 0 0 / 30% 30%, #3fa34d`
    }
  },
  {
    id: 'p:losanges',
    label: 'Losanges',
    style: {
      background: `linear-gradient(135deg, ${WHITE} 25%, transparent 25%) -10% 0 / 20% 20%, linear-gradient(225deg, ${WHITE} 25%, transparent 25%) -10% 0 / 20% 20%, #5b5fd6`
    }
  }
]

/** Identifiant d'arrière-plan d'un profil ; l'ancienne couleur sert de repli. */
export function backgroundId(profile: Pick<Profile, 'background' | 'color'>): string {
  return profile.background || `c:${profile.color}`
}

/** Style CSS d'un arrière-plan ; un uni quelconque (`c:#rrggbb`) est accepté même hors liste. */
export function backgroundStyle(profile: Pick<Profile, 'background' | 'color'>): CSSProperties {
  const id = backgroundId(profile)
  const known = BACKGROUNDS.find((b) => b.id === id)
  if (known) return known.style
  const solid = /^c:(#[0-9a-f]{6})$/i.exec(id)
  return { background: solid ? solid[1] : profile.color }
}
