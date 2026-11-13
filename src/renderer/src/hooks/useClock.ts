import { useEffect, useState } from 'react'

export interface ClockText {
  /** « 12:34 » : heure sur 24 h. */
  time: string
  /** Vide en 24 h ; « AM » ou « PM » si on repasse en 12 h. */
  period: string
}

const format = (): ClockText => ({
  time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false }),
  period: ''
})
export function useClock(): ClockText {
  const [time, setTime] = useState<ClockText>(format)
  useEffect(() => {
    const id = setInterval(() => setTime((old) => { const n = format(); return n.time === old.time && n.period === old.period ? old : n }), 5000)
    return () => clearInterval(id)
  }, [])
  return time
}

interface BatteryManager extends EventTarget {
  level: number
  charging: boolean
}

export interface Battery {
  level: number
  charging: boolean
}

/** Renvoie null si la machine n'expose pas de batterie. */
export function useBattery(): Battery | null {
  const [battery, setBattery] = useState<Battery | null>(null)
  useEffect(() => {
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManager> }
    if (!nav.getBattery) return
    let manager: BatteryManager | null = null
    const update = (): void => {
      if (manager) setBattery({ level: manager.level, charging: manager.charging })
    }
    nav.getBattery().then((m) => {
      manager = m
      update()
      m.addEventListener('levelchange', update)
      m.addEventListener('chargingchange', update)
    })
    return () => {
      manager?.removeEventListener('levelchange', update)
      manager?.removeEventListener('chargingchange', update)
    }
  }, [])
  return battery
}
