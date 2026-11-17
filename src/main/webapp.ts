import { BrowserWindow, WebContentsView } from 'electron'

/**
 * Un site (YouTube…) affiché DANS la fenêtre du lanceur, par-dessus l'accueil. La manette n'est lisible que par la page qui
 * a le focus : un petit script posé sur la page la lit et la signale au lanceur, qui envoie alors de vraies touches du clavier.
 * Le bouton « Retour au lanceur » (ou le bouton View / Retour de la manette) referme tout.
 */
const PAD_PREFIX = '__launcher_pad:'

// Touches envoyées à la page pour chaque action de la manette.
const KEYS: Record<string, string> = { up: 'Up', down: 'Down', left: 'Left', right: 'Right', confirm: 'Return', back: 'Escape' }

/** Script de la page : bouton « Retour » et lecture de la manette (croix, stick, A, B, View). `swap` : A et B inversés. */
const injectScript = (swap: boolean): string => `(() => {
  if (window.__clPad) return
  window.__clPad = true
  const send = (a) => console.log('${PAD_PREFIX}' + a)
  const b = document.createElement('button')
  b.textContent = '← Retour au lanceur'
  b.style.cssText = 'position:fixed;z-index:2147483647;left:12px;bottom:12px;padding:8px 16px;border-radius:999px;border:0;background:#e60012;color:#fff;font:600 14px sans-serif;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.4);opacity:.85'
  b.onclick = () => send('close')
  const attach = () => document.body && document.body.appendChild(b)
  attach(); document.addEventListener('DOMContentLoaded', attach)
  const held = {}
  setInterval(() => {
    const now = Date.now()
    const down = new Set()
    for (const g of navigator.getGamepads()) {
      if (!g) continue
      const x = g.axes[0] || 0, y = g.axes[1] || 0, p = (i) => g.buttons[i] && g.buttons[i].pressed
      if (p(14) || x < -0.6) down.add('left'); if (p(15) || x > 0.6) down.add('right')
      if (p(12) || y < -0.6) down.add('up'); if (p(13) || y > 0.6) down.add('down')
      if (p(${swap ? 1 : 0})) down.add('confirm'); if (p(${swap ? 0 : 1})) down.add('back')
      if (p(8)) down.add('close')
    }
    for (const a of down) {
      if (!(a in held)) { send(a); held[a] = now + 350 }
      else if (now >= held[a] && a !== 'close' && a !== 'confirm' && a !== 'back') { send(a); held[a] = now + 110 }
    }
    for (const a of Object.keys(held)) if (!down.has(a)) delete held[a]
  }, 16)
})()`

export interface WebAppOptions {
  /** Adresse de départ. */
  url: string
  /** Sites autorisés pour la navigation (noms de domaine, sous-domaines compris). */
  hosts: string[]
  /** Se présenter comme une télévision (interface pensée pour la manette). */
  userAgent?: string
  /** Un dossier de cookies par application : la connexion est gardée d'une fois sur l'autre. */
  partition: string
  /** Valider avec le bouton de droite (réglage « manette »). */
  swapConfirm: boolean
}

/** Le domaine fait-il partie des sites autorisés ? */
export function hostAllowed(url: string, hosts: string[]): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && hosts.some((h) => u.hostname === h || u.hostname.endsWith('.' + h))
  } catch {
    return false
  }
}

export class WebApp {
  private view: WebContentsView | null = null
  private fit: (() => void) | null = null
  private opening = false

  constructor(
    private getWin: () => BrowserWindow | null,
    private log: (...a: unknown[]) => void,
    /** Prévenu quand le site s'ouvre ou se ferme (le son du lanceur se coupe pendant ce temps). */
    private onChange: (open: boolean) => void = () => undefined
  ) {}

  get isOpen(): boolean {
    return this.view !== null
  }

  /** Affiche le site dans le lanceur. Renvoie un message d'erreur, ou null. */
  async open(opts: WebAppOptions): Promise<string | null> {
    const win = this.getWin()
    if (!win) return 'Fenêtre du lanceur indisponible.'
    if (this.view || this.opening) return null
    this.opening = true
    try {
      const view = new WebContentsView({
        webPreferences: { sandbox: true, partition: opts.partition, autoplayPolicy: 'no-user-gesture-required' }
      })
      const wc = view.webContents
      if (opts.userAgent) wc.setUserAgent(opts.userAgent)
      // Aucune permission (caméra, micro, position, notifications…) pour un site affiché ici.
      wc.session.setPermissionRequestHandler((_wc, _perm, done) => done(false))
      wc.setWindowOpenHandler(() => ({ action: 'deny' }))
      wc.on('will-navigate', (e, url) => {
        if (!hostAllowed(url, opts.hosts)) e.preventDefault()
      })
      this.view = view
      win.contentView.addChildView(view)
      this.fit = (): void => {
        const [width, height] = win.getContentSize()
        view.setBounds({ x: 0, y: 0, width, height })
      }
      this.fit()
      win.on('resize', this.fit)
      wc.on('dom-ready', () => void wc.executeJavaScript(injectScript(opts.swapConfirm)).catch(() => undefined))
      wc.on('console-message', (event) => {
        const message = typeof event === 'object' && event && 'message' in event ? String((event as { message: unknown }).message) : ''
        if (!message.startsWith(PAD_PREFIX)) return
        const action = message.slice(PAD_PREFIX.length)
        if (action === 'close') return this.close()
        const keyCode = KEYS[action]
        if (!keyCode) return
        wc.sendInputEvent({ type: 'keyDown', keyCode })
        wc.sendInputEvent({ type: 'keyUp', keyCode })
      })
      this.onChange(true)
      await wc.loadURL(opts.url)
      wc.focus()
      return null
    } catch (e) {
      this.log('site : affichage impossible', String(e))
      this.close()
      return 'Le site n’a pas pu s’afficher. Vérifie ta connexion.'
    } finally {
      this.opening = false
    }
  }

  /** Referme le site et rend la main à l'accueil. */
  close(): void {
    const win = this.getWin()
    const view = this.view
    if (!view) return
    this.view = null
    if (win && !win.isDestroyed()) {
      if (this.fit) win.off('resize', this.fit)
      win.contentView.removeChildView(view)
    }
    this.fit = null
    if (!view.webContents.isDestroyed()) view.webContents.close()
    if (win && !win.isDestroyed()) win.webContents.focus()
    this.onChange(false)
  }
}
