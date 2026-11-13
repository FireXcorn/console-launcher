import type { PowerAction } from '../shared/types'

/** Commande Windows correspondant à une action d'alimentation (arguments séparés, pas de shell). */
export function powerCommand(action: PowerAction): { file: string; args: string[] } | null {
  switch (action) {
    case 'sleep':
      // Veille ; si l'hibernation est activée dans Windows, il peut hiberner à la place.
      return { file: 'rundll32.exe', args: ['powrprof.dll,SetSuspendState', '0,1,0'] }
    case 'restart':
      return { file: 'shutdown.exe', args: ['/r', '/t', '0'] }
    case 'shutdown':
      return { file: 'shutdown.exe', args: ['/s', '/t', '0'] }
    default:
      return null
  }
}

/** Extrait le nom du réseau de la sortie de `netsh wlan show interfaces` (hors BSSID). */
export function parseSsid(output: string): string | null {
  const m = /^\s*SSID\s*:\s*(.+?)\s*$/m.exec(output)
  return m && m[1] ? m[1] : null
}

/** Qualité du signal Wi-Fi (« Signal : 87% ») de la même sortie, ou null. */
export function parseSignal(output: string): number | null {
  const m = /^\s*Signal\s*:\s*(\d{1,3})\s*%/m.exec(output)
  return m ? Math.min(100, Number(m[1])) : null
}

/** Contenu du lanceur de session Linux (~/.config/autostart/*.desktop). */
export function desktopEntry(execPath: string, name: string): string {
  // Les guillemets protègent un chemin avec espaces ; les retours à la ligne sont interdits dans la valeur.
  const exec = `"${execPath.replace(/[\r\n"]/g, '')}"`
  return `[Desktop Entry]\nType=Application\nName=${name.replace(/[\r\n]/g, ' ')}\nExec=${exec}\nX-GNOME-Autostart-enabled=true\n`
}

const ALLOWED_SETTINGS = new Set(['ms-settings:powersleep', 'ms-settings:network-wifi', 'ms-settings:network'])

/** Seuls les liens https et quelques pages de réglages Windows peuvent être ouverts. */
export function isAllowedExternal(url: string): boolean {
  if (ALLOWED_SETTINGS.has(url)) return true
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}
