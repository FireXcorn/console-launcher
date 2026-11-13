import type { JSX as ReactJSX } from 'react'
import type { Api } from '../../shared/types'

declare global {
  interface Window {
    api: Api
  }
  // React 19 n'expose plus l'espace de noms JSX global.
  namespace JSX {
    type Element = ReactJSX.Element
  }
}

export {}
