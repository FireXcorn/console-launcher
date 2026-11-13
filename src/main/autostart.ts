import { app } from 'electron'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { desktopEntry } from './system'

/**
 * Lance (ou non) le lanceur à l'ouverture de session : Windows et macOS via le système d'Electron,
 * Linux via un fichier .desktop dans ~/.config/autostart.
 */
export function applyAutoStart(enabled: boolean, name: string): void {
  try {
    if (process.platform === 'linux') {
      const dir = join(homedir(), '.config', 'autostart')
      const file = join(dir, 'console-launcher.desktop')
      if (enabled) {
        mkdirSync(dir, { recursive: true })
        writeFileSync(file, desktopEntry(process.execPath, name), 'utf8')
      } else {
        rmSync(file, { force: true })
      }
    } else if (app.isPackaged) {
      app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath })
    }
  } catch {
    // Dossier non inscriptible : le réglage reste sans effet plutôt que de bloquer le lanceur.
  }
}
