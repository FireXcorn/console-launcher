import { BrowserWindow, WebContentsView } from 'electron'
import { execFile, spawn, type ChildProcess } from 'child_process'
import { dirname } from 'path'
import { glassBackButton, isCloseShortcut } from './webapp'

/**
 * Pokémon Home (PKVault) affiché DANS la fenêtre du lanceur. PKVault sert son interface sur une adresse locale
 * (127.0.0.1) : le lanceur le démarre, cache la fenêtre propre du programme et affiche cette page par-dessus
 * l'accueil. Le bouton « Retour au lanceur » (verre liquide), la touche F4 (ou Maj + F4) ou le bouton Retour de la manette referme tout.
 */
// shortcut: Windows seulement (la fenêtre de PKVault est cachée avec user32) ; sous Linux elle reste visible à côté.
const PORTS = Array.from({ length: 24 }, (_, i) => 49152 + i)
const HASH = 'launcher-back'

const HIDE_WINDOW = `Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public static class W { [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c); }
'@
$end = (Get-Date).AddSeconds(90)
while ((Get-Date) -lt $end) {
  $p = Get-Process -Id $env:CL_PID -ErrorAction SilentlyContinue
  if (-not $p) { break }
  if ($p.MainWindowHandle -ne 0) { [void][W]::ShowWindow($p.MainWindowHandle, 0) }
  Start-Sleep -Milliseconds 150
}
`

/** Bouton « Retour » posé sur la page, et bouton Retour (View) de la manette : ils changent l'ancre de l'adresse. */
const INJECT = `(() => {
  if (window.__clBack) return
  window.__clBack = true
  const go = () => { location.hash = '${HASH}' + Date.now() }
  ${glassBackButton('go()')}
  let held = false
  setInterval(() => {
    const on = [...navigator.getGamepads()].some((g) => g && g.buttons[8] && g.buttons[8].pressed)
    if (on && !held) go()
    held = on
  }, 100)
})()`

async function findPort(): Promise<number | null> {
  for (const port of PORTS) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/settings`, { signal: AbortSignal.timeout(400) })
      if ((await r.text()).includes('pkhexVersion')) return port
    } catch {
      /* rien n'écoute sur ce port */
    }
  }
  return null
}

export class HomeView {
  private view: WebContentsView | null = null
  private child: ChildProcess | null = null
  private hider: ChildProcess | null = null
  private opening = false
  private fit: (() => void) | null = null

  constructor(
    private getWin: () => BrowserWindow | null,
    private log: (...a: unknown[]) => void
  ) {}

  /** Démarre PKVault (s'il ne tourne pas déjà) et l'affiche dans le lanceur. Renvoie un message d'erreur, ou null. */
  async open(exe: string): Promise<string | null> {
    const win = this.getWin()
    if (!win) return 'Fenêtre du lanceur indisponible.'
    if (this.view || this.opening) return null
    this.opening = true
    try {
      let port = await findPort()
      if (!port) {
        const child = spawn(exe, [], { cwd: dirname(exe), stdio: 'ignore', windowsHide: true })
        this.child = child
        child.once('error', (e) => this.log('Pokémon Home : lancement impossible', String(e)))
        this.hider = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(HIDE_WINDOW, 'utf16le').toString('base64')], {
          env: { ...process.env, CL_PID: String(child.pid ?? 0) },
          windowsHide: true,
          stdio: 'ignore'
        })
        this.hider.once('error', () => undefined)
        for (let i = 0; i < 80 && !port && child.exitCode === null; i++) {
          await new Promise((r) => setTimeout(r, 500))
          port = await findPort()
        }
      }
      if (!port) {
        this.close()
        return 'Pokémon Home n’a pas démarré.'
      }
      const view = new WebContentsView({ webPreferences: { sandbox: true } })
      this.view = view
      win.contentView.addChildView(view)
      this.fit = (): void => {
        const [width, height] = win.getContentSize()
        view.setBounds({ x: 0, y: 0, width, height })
      }
      this.fit()
      win.on('resize', this.fit)
      // La page ne sort jamais de PKVault (adresse locale) : ni nouvelle fenêtre, ni navigation ailleurs.
      view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
      view.webContents.on('will-navigate', (e, url) => {
        if (!url.startsWith(`http://127.0.0.1:${port}/`)) e.preventDefault()
      })
      view.webContents.on('before-input-event', (e, input) => {
        if (input.type === 'keyDown' && isCloseShortcut(input)) {
          e.preventDefault()
          this.close()
        }
      })
      view.webContents.on('dom-ready', () => void view.webContents.executeJavaScript(INJECT).catch(() => undefined))
      view.webContents.on('did-navigate-in-page', (_e, url) => {
        if (url.includes('#' + HASH)) this.close()
      })
      await view.webContents.loadURL(`http://127.0.0.1:${port}/index.html`)
      view.webContents.focus()
      return null
    } catch (e) {
      this.log('Pokémon Home : affichage impossible', String(e))
      this.close()
      return 'Pokémon Home n’a pas pu s’afficher.'
    } finally {
      this.opening = false
    }
  }

  /** Referme la page, arrête PKVault s'il a été démarré par le lanceur, et rend la main à l'accueil. */
  close(): void {
    const win = this.getWin()
    const view = this.view
    this.view = null
    if (win && !win.isDestroyed()) {
      if (this.fit) win.off('resize', this.fit)
      if (view) win.contentView.removeChildView(view)
    }
    this.fit = null
    if (view && !view.webContents.isDestroyed()) view.webContents.close()
    this.hider?.kill()
    this.hider = null
    const pid = this.child?.pid
    this.child = null
    if (pid) execFile('taskkill', ['/PID', String(pid), '/T', '/F'], () => undefined)
    if (win && !win.isDestroyed()) win.webContents.focus()
  }
}
