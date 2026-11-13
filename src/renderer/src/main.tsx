import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/app.css'
import './styles/screens.css'

async function start(): Promise<void> {
  // Hors d'Electron (aperçu dans un navigateur), on branche une fausse API.
  if (import.meta.env.DEV && !window.api) {
    const { installDevMock } = await import('./devMock')
    installDevMock()
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}

start()
