/**
 * Sons de menu (synthétisés, sans fichier) et musique de fond.
 * Aucune musique n'est fournie : elle ne joue que si l'utilisateur dépose un fichier `menu.*`
 * dans son dossier de sons (réglage `audioDir`).
 */
export type SoundName = 'deplacer' | 'valider' | 'retour' | 'ouvrir' | 'lancer' | 'refuser'

export interface AudioSettings {
  /** 0 à 100. */
  sfx: number
  /** 0 à 100. */
  music: number
  muted: boolean
}

const CUSTOM_SOUNDS = ['deplacer', 'valider', 'retour', 'lancer', 'refuser'] as const

class AudioEngine {
  private ctx: AudioContext | null = null
  private settings: AudioSettings = { sfx: 70, music: 40, muted: false }
  /** Vrai tant qu'un jeu tourne : plus aucun son. */
  private suspended = false
  private custom = new Map<string, AudioBuffer>()
  private customMusicUrl: string | null = null

  private music: HTMLAudioElement | null = null
  private musicWanted = false
  /** Vrai entre le début du fondu de lancement et le retour du jeu. */
  private fadingOut = false
  private fadeTimer: number | undefined

  private counts: Record<string, number> = {}

  // ----- Réglages -----

  configure(next: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...next }
    this.applyMusicVolume()
  }

  private get sfxGain(): number {
    return this.settings.muted ? 0 : Math.pow(this.settings.sfx / 100, 1.5)
  }

  private get musicTarget(): number {
    return this.settings.muted || this.suspended ? 0 : this.settings.music / 100
  }

  /** Un geste de l'utilisateur lève le blocage éventuel du navigateur sur la lecture automatique. */
  unlock(): void {
    this.context()?.resume().catch(() => undefined)
    // Ne relance que si la lecture avait été refusée : sinon chaque touche annulerait un fondu en cours.
    if (this.musicWanted && !this.fadingOut && this.music?.paused) void this.playMusicElement()
  }

  private context(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext()
      } catch {
        return null
      }
    }
    return this.ctx
  }

  // ----- Sons personnalisés (dossier de l'utilisateur) -----

  async loadCustom(): Promise<void> {
    const ctx = this.context()
    this.custom.clear()
    if (this.customMusicUrl) URL.revokeObjectURL(this.customMusicUrl)
    this.customMusicUrl = null
    const menu = await window.api.customAudio('menu')
    if (menu) this.customMusicUrl = URL.createObjectURL(new Blob([menu.slice().buffer as ArrayBuffer]))
    if (ctx) {
      for (const name of CUSTOM_SOUNDS) {
        const bytes = await window.api.customAudio(name)
        if (!bytes) continue
        try {
          this.custom.set(name, await ctx.decodeAudioData(bytes.slice().buffer as ArrayBuffer))
        } catch {
          window.api.log(`son personnalisé illisible : ${name}`)
        }
      }
    }
    // La musique peut avoir changé de source (ou être apparue) : on la relance si elle est voulue.
    if (this.musicWanted) {
      this.stopMusicNow()
      this.startMusic()
    }
  }

  // ----- Effets sonores -----

  play(name: SoundName): void {
    this.counts[name] = (this.counts[name] ?? 0) + 1
    if (this.suspended || this.sfxGain === 0) return
    const ctx = this.context()
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume().catch(() => undefined)

    const customName = name === 'ouvrir' ? 'valider' : name
    const buffer = this.custom.get(customName)
    if (buffer) {
      const src = ctx.createBufferSource()
      const gain = ctx.createGain()
      gain.gain.value = this.sfxGain
      src.buffer = buffer
      src.connect(gain).connect(ctx.destination)
      src.start()
      return
    }

    const out = ctx.createGain()
    out.gain.value = this.sfxGain
    out.connect(ctx.destination)
    const t = ctx.currentTime
    const tone = (
      freq: number,
      at: number,
      dur: number,
      type: OscillatorType,
      peak: number,
      endFreq?: number
    ): void => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, t + at)
      if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + at + dur)
      g.gain.setValueAtTime(0.0001, t + at)
      g.gain.exponentialRampToValueAtTime(peak, t + at + 0.008)
      g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur)
      osc.connect(g).connect(out)
      osc.start(t + at)
      osc.stop(t + at + dur + 0.02)
    }

    switch (name) {
      case 'deplacer':
        tone(1180, 0, 0.045, 'sine', 0.22, 900)
        break
      case 'valider':
        tone(660, 0, 0.07, 'triangle', 0.3)
        tone(990, 0.06, 0.12, 'triangle', 0.3)
        break
      case 'retour':
        tone(760, 0, 0.07, 'triangle', 0.28)
        tone(540, 0.06, 0.11, 'triangle', 0.28)
        break
      case 'ouvrir':
        tone(480, 0, 0.16, 'sine', 0.3, 960)
        tone(960, 0.1, 0.1, 'sine', 0.16)
        break
      case 'lancer':
        tone(330, 0, 0.5, 'sine', 0.22, 1320)
        ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.08 + i * 0.07, 0.5, 'triangle', 0.2))
        break
      case 'refuser':
        tone(170, 0, 0.09, 'square', 0.14)
        tone(150, 0.13, 0.13, 'square', 0.14)
        break
    }
  }

  // ----- Musique (uniquement celle déposée par l'utilisateur) -----

  /** Lance la musique de fond avec un fondu, s'il existe un fichier `menu.*` ; sinon silence. */
  startMusic(): void {
    this.musicWanted = true
    if (this.suspended || !this.customMusicUrl) return
    if (!this.music) {
      const audio = new Audio(this.customMusicUrl)
      audio.loop = true
      audio.volume = 0
      this.music = audio
    }
    void this.playMusicElement()
  }

  private async playMusicElement(): Promise<void> {
    const audio = this.music
    if (!audio || this.suspended || this.fadingOut) return
    try {
      await audio.play()
      // La lecture a pu être interrompue (lancement d'un jeu) pendant l'attente.
      if (!this.suspended && !this.fadingOut) this.fadeMusic(this.musicTarget, 1500)
    } catch {
      // Lecture refusée : elle sera retentée au premier geste (unlock).
    }
  }

  private applyMusicVolume(): void {
    if (this.music && !this.music.paused) this.fadeMusic(this.musicTarget, 200)
  }

  private fadeMusic(target: number, ms: number, then?: () => void): void {
    window.clearInterval(this.fadeTimer)
    const audio = this.music
    if (!audio) return then?.()
    const from = audio.volume
    const steps = Math.max(1, Math.round(ms / 40))
    let i = 0
    this.fadeTimer = window.setInterval(() => {
      i++
      audio.volume = Math.min(1, Math.max(0, from + ((target - from) * i) / steps))
      if (i >= steps) {
        window.clearInterval(this.fadeTimer)
        then?.()
      }
    }, 40)
  }

  /** Coupe la musique en fondu (lancement d'un jeu) ; elle reprendra avec `setSuspended(false)`. */
  fadeOutMusic(ms = 500): void {
    this.fadingOut = true
    this.fadeMusic(0, ms, () => this.music?.pause())
  }

  /** Vrai pendant qu'un jeu tourne : plus de sons, musique en pause ; au retour tout reprend. */
  setSuspended(value: boolean): void {
    if (value) {
      if (this.suspended) return
      this.suspended = true
      window.clearInterval(this.fadeTimer)
      this.music?.pause()
      return
    }
    // Retour au menu : même après un lancement qui a échoué (fondu commencé sans jeu démarré).
    const wasQuiet = this.suspended || this.fadingOut
    this.suspended = false
    this.fadingOut = false
    if (this.musicWanted && wasQuiet) this.startMusic()
  }

  private stopMusicNow(): void {
    window.clearInterval(this.fadeTimer)
    this.music?.pause()
    this.music = null
  }

  // ----- Diagnostic -----

  state(): Record<string, unknown> {
    return {
      contexte: this.ctx?.state ?? 'aucun',
      suspendu: this.suspended,
      muet: this.settings.muted,
      source: this.customMusicUrl ? 'personnalisée' : 'aucune',
      musique: this.music
        ? { enPause: this.music.paused, position: Math.round(this.music.currentTime * 10) / 10, volume: Math.round(this.music.volume * 100) / 100 }
        : null,
      sonsJoues: this.counts,
      sonsPersonnalises: [...this.custom.keys()]
    }
  }
}

export const engine = new AudioEngine()
;(window as unknown as { __audioState?: () => Record<string, unknown> }).__audioState = () => engine.state()
