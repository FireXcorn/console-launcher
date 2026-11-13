import type { Profile, ProfileArt } from '../../../shared/types'
import { backgroundStyle } from './backgrounds'
import { UserIcon } from './icons'

/**
 * Avatar rond : l'image personnelle (plein rond) ; sinon un personnage (créature du lanceur ou image
 * de l'utilisateur) posé sur l'arrière-plan choisi ; sinon une silhouette sur cet arrière-plan.
 */
export default function Avatar({ profile, art }: { profile: Profile; art?: ProfileArt }): JSX.Element {
  if (art?.image) return <img className="avatar-img" src={art.image} alt="" draggable={false} />
  return (
    <span className="avatar-fallback" style={backgroundStyle(profile)}>
      {art?.character ? (
        <img className="avatar-char" src={art.character} alt="" draggable={false} />
      ) : (
        <UserIcon />
      )}
    </span>
  )
}
