import { useEffect, useRef, useState } from 'react'
import Screen from '../components/Screen'
import { useInput } from '../hooks/useInput'

interface Props {
  name: string
  onSave: (name: string) => void
  onBack: () => void
}

/** « Modifier le pseudo » : un champ plein cadre, Valider ou Annuler. */
export default function EditNameScreen({ name, onSave, onBack }: Props): JSX.Element {
  const [value, setValue] = useState(name)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  const save = (): void => onSave(value.trim() || 'Joueur')

  // Échap annule ; Entrée valide (le champ garde le clavier pour écrire).
  useInput((action) => {
    if (action === 'back') onBack()
  })

  return (
    <Screen title="Modifier le pseudo" onBack={onBack} hints={[{ key: 'Entrée', label: 'Valider', wide: true }]}>
      <div className="editname" data-native-input>
        <input
          ref={ref}
          value={value}
          maxLength={24}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              save()
            }
          }}
          aria-label="Pseudo"
        />
        <small>{value.length} / 24</small>
        <div className="editname-actions">
          <button className="btn" onClick={onBack}>
            Annuler
          </button>
          <button className="btn focused" onClick={save}>
            Valider
          </button>
        </div>
      </div>
    </Screen>
  )
}
