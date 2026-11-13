import { execFile, spawn, type ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import type { GameState } from '../shared/types'
import type { ScannedGame } from './library'

const POLL_MS = 2500
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

// -EncodedCommand évite tout problème de guillemets ; les valeurs passent par l'environnement.
const encode = (script: string): string => Buffer.from(script, 'utf16le').toString('base64')

const UNDER_DIR = String.raw`$d = $env:CL_DIR.TrimEnd('\') + '\'
function Get-GameProcs { @(Get-Process | Where-Object { $_.Path -and $_.Path.StartsWith($d, [StringComparison]::OrdinalIgnoreCase) }) }
`

/**
 * Nombre de processus dont l'exécutable se trouve dans `dir`.
 * Sert à suivre le jeu quand l'exécutable lancé n'est qu'un relais qui se ferme aussitôt.
 */
export function countProcessesUnder(dir: string): Promise<number> {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-EncodedCommand', encode(UNDER_DIR + '(Get-GameProcs).Count')],
      { env: { ...process.env, CL_DIR: dir }, windowsHide: true },
      (err, stdout) => resolve(err ? 0 : parseInt(String(stdout).trim(), 10) || 0)
    )
  })
}

/** Réglages du suivi d'un jeu lancé par un émulateur. */
export interface EmulatorWatch {
  /** Expression régulière sur le titre de la fenêtre : le jeu tourne quand elle correspond. */
  readyTitle?: string
  /** Journal de l'émulateur : le jeu tourne quand une nouvelle ligne correspond à `readyPattern`. */
  readyLog?: string
  readyPattern?: string
  /** Pause entre ce signal et le retrait de l'écran noir, le temps du premier affichage (ms). */
  settleMs?: number
  /**
   * Les questions de l'émulateur dont le texte correspond à cette expression reçoivent « oui »
   * automatiquement (ex. « Utiliser les paramètres recommandés ? »).
   */
  dialogPattern?: string
}

/**
 * Processus auxiliaire qui surveille la fenêtre du jeu tant qu'il tourne.
 *
 * Jeu normal : titre et icône ; plein écran sans bordure dès que la fenêtre existe (25 premières
 * secondes) ; écrit READY quand elle couvre l'écran.
 *
 * Jeu émulé (`CL_EMU=1`) : l'émulateur n'est pas touché, sauf pour répondre « oui » à ses questions
 * (via l'accessibilité Windows, repli sur Entrée). READY est écrit quand le journal de l'émulateur
 * ou le titre de sa fenêtre montre que le jeu tourne.
 *
 * Les lignes `LOG …` sont des traces destinées au journal du lanceur.
 * L'icône appartient à ce processus : il doit rester en vie aussi longtemps que la fenêtre.
 */
const DRESSER_SCRIPT =
  UNDER_DIR +
  String.raw`Add-Type -AssemblyName System.Drawing
$sig = @'
public delegate bool EnumProc(IntPtr h, IntPtr l);
[DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
[DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
[DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr h, uint cmd);
[DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int i);
[DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr h, int i, int v);
[DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
[DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
[DllImport("user32.dll")] public static extern IntPtr MonitorFromWindow(IntPtr h, uint flags);
[DllImport("user32.dll")] public static extern bool GetMonitorInfo(IntPtr m, ref MONITORINFO mi);
[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
[DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern bool SetWindowText(IntPtr h, string t);
[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, System.Text.StringBuilder sb, int n);
[DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
[StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
[StructLayout(LayoutKind.Sequential)] public struct MONITORINFO { public int cbSize; public RECT rcMonitor; public RECT rcWork; public uint dwFlags; }
/// La plus grande fenêtre principale visible des processus donnés (IntPtr.Zero s'il n'y en a pas).
public static IntPtr LargestWindowOf(uint[] pids) {
  IntPtr best = IntPtr.Zero; long bestArea = 0;
  EnumWindows(delegate (IntPtr h, IntPtr l) {
    uint pid; GetWindowThreadProcessId(h, out pid);
    if (Array.IndexOf(pids, pid) < 0 || !IsWindowVisible(h)) return true;
    if (GetWindow(h, 4) != IntPtr.Zero) return true;
    if ((GetWindowLong(h, -20) & 0x80) != 0) return true;
    RECT r; GetWindowRect(h, out r);
    long w = r.R - r.L, hh = r.B - r.T;
    if (w < 200 || hh < 150) return true;
    if (w * hh > bestArea) { bestArea = w * hh; best = h; }
    return true;
  }, IntPtr.Zero);
  return best;
}
/// Les boîtes de dialogue visibles (fenêtres possédées par une autre) des processus donnés.
public static IntPtr[] DialogsOf(uint[] pids) {
  var found = new System.Collections.Generic.List<IntPtr>();
  EnumWindows(delegate (IntPtr h, IntPtr l) {
    uint pid; GetWindowThreadProcessId(h, out pid);
    if (Array.IndexOf(pids, pid) < 0 || !IsWindowVisible(h)) return true;
    if (GetWindow(h, 4) == IntPtr.Zero) return true;
    if ((GetWindowLong(h, -20) & 0x80) != 0) return true;
    found.Add(h);
    return true;
  }, IntPtr.Zero);
  return found.ToArray();
}
'@
$types = Add-Type -MemberDefinition $sig -Name Win -Namespace ConsoleLauncher -PassThru
$W = @($types)[0]
[void]$W::SetProcessDPIAware()
$isEmu = $env:CL_EMU -eq '1'

function Set-Borderless($h) {
  $mon = $W::MonitorFromWindow($h, 2)
  $mi = New-Object 'ConsoleLauncher.Win+MONITORINFO'
  $mi.cbSize = [Runtime.InteropServices.Marshal]::SizeOf($mi)
  if (-not $W::GetMonitorInfo($mon, [ref]$mi)) { return $false }
  $r = New-Object 'ConsoleLauncher.Win+RECT'
  [void]$W::GetWindowRect($h, [ref]$r)
  $m = $mi.rcMonitor
  $style = $W::GetWindowLong($h, -16)
  $framed = ($style -band 0x00C00000) -ne 0
  $covers = ($r.L -le $m.L) -and ($r.T -le $m.T) -and ($r.R -ge $m.R) -and ($r.B -ge $m.B)
  if ((-not $framed) -and $covers) { return $true }
  $new = ($style -band (-bnot 0x00CF0000)) -bor ([int]-2147483648)
  [void]$W::ShowWindow($h, 1)
  [void]$W::SetWindowLong($h, -16, $new)
  $flags = 0x0020 -bor 0x0040
  [void]$W::SetWindowPos($h, [IntPtr](-1), $m.L, $m.T, ($m.R - $m.L), ($m.B - $m.T), $flags)
  [void]$W::SetWindowPos($h, [IntPtr](-2), $m.L, $m.T, ($m.R - $m.L), ($m.B - $m.T), $flags)
  [void]$W::SetForegroundWindow($h)
  return $true
}

if ($isEmu) {
  Add-Type -AssemblyName UIAutomationClient
  Add-Type -AssemblyName UIAutomationTypes
  $yes = '^&?(yes|oui|ja|s[ií]|sim|да)$'
  $script:answered = @{}
  # Répond « oui » à une question de l'émulateur dont le texte correspond à CL_DIALOG.
  function Answer-Dialog($h) {
    try {
      $el = [System.Windows.Automation.AutomationElement]::FromHandle($h)
      $all = $el.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
      $text = @($el.Current.Name)
      foreach ($c in $all) { $text += $c.Current.Name }
      $joined = ($text -join ' ')
      if ($joined -notmatch $env:CL_DIALOG) { return $null }
      $short = $joined.Substring(0, [Math]::Min(100, $joined.Length))
      foreach ($c in $all) {
        if ($c.Current.ControlType.Id -eq [System.Windows.Automation.ControlType]::Button.Id -and $c.Current.Name -match $yes) {
          $c.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
          return ('LOG question acceptee (bouton) : ' + $short)
        }
      }
      # Repli : Entrée envoyée à la boîte ; dans ces questions, « oui » est le bouton par défaut.
      [void]$W::PostMessage($h, 0x100, [IntPtr]13, [IntPtr]0x1C0001)
      [void]$W::PostMessage($h, 0x101, [IntPtr]13, [IntPtr]0xC01C0001)
      return ('LOG question acceptee (Entree) : ' + $short)
    } catch { return $null }
  }

  # Nouvelles lignes du journal de l'émulateur depuis le lancement.
  $script:logOffset = 0
  if ($env:CL_LOG -and (Test-Path -LiteralPath $env:CL_LOG)) { $script:logOffset = (Get-Item -LiteralPath $env:CL_LOG).Length }
  function Read-NewLog {
    if (-not $env:CL_LOG) { return '' }
    try {
      $fs = [IO.File]::Open($env:CL_LOG, 'Open', 'Read', 'ReadWrite')
      try {
        if ($fs.Length -lt $script:logOffset) { $script:logOffset = 0 }
        $count = [int]($fs.Length - $script:logOffset)
        if ($count -le 0) { return '' }
        $fs.Position = $script:logOffset
        $buf = New-Object byte[] $count
        [void]$fs.Read($buf, 0, $count)
        $script:logOffset = $fs.Length
        return [Text.Encoding]::UTF8.GetString($buf)
      } finally { $fs.Dispose() }
    } catch { return '' }
  }
}

$icon = [IntPtr]::Zero
if ($env:CL_ICON -and (Test-Path -LiteralPath $env:CL_ICON)) {
  try { $icon = ([System.Drawing.Bitmap]::FromFile($env:CL_ICON)).GetHicon() } catch {}
}
$settle = 0
if ($env:CL_SETTLE) { $settle = [int]$env:CL_SETTLE }
$start = Get-Date
$seen = $false
$firstWindow = $null
$ready = $false
$logHitAt = $null
$pids = [uint32[]]@()
$lastRefresh = [DateTime]::MinValue
$lastDress = [DateTime]::MinValue
$lastSlow = [DateTime]::MinValue
$lastTitle = ''
while ($true) {
  $now = Get-Date
  # La liste des processus du jeu se rafraîchit chaque seconde (ou en continu tant qu'il n'a pas démarré) ;
  # le reste est très léger et tourne ~30 fois par seconde.
  if ($pids.Count -eq 0 -or ($now - $lastRefresh).TotalMilliseconds -gt 1000) {
    $procs = Get-GameProcs
    if ($procs.Count -eq 0) {
      if ($seen -or ($now - $start).TotalSeconds -gt 90) { break }
      $pids = [uint32[]]@()
    } else {
      $seen = $true
      $pids = [uint32[]]@($procs | ForEach-Object { $_.Id })
    }
    $lastRefresh = $now
  }
  if ($pids.Count -gt 0) {
    if ($isEmu) {
      if (-not $ready -and ($now - $lastSlow).TotalMilliseconds -gt 300) {
        $lastSlow = $now
        # 1. Questions de l'émulateur : réponse « oui ».
        if ($env:CL_DIALOG) {
          foreach ($dlg in $W::DialogsOf($pids)) {
            $msg = Answer-Dialog $dlg
            if ($msg) { Write-Output $msg }
          }
        }
        # 2. Le jeu tourne-t-il ? Journal de l'émulateur d'abord, titre de la fenêtre ensuite.
        if ($null -eq $logHitAt -and $env:CL_LOGPAT) {
          $new = Read-NewLog
          if ($new -and $new -match $env:CL_LOGPAT) { $logHitAt = $now; Write-Output 'LOG le journal de l''emulateur annonce le jeu' }
        }
        if ($null -eq $logHitAt -and $env:CL_READY) {
          $h = $W::LargestWindowOf($pids)
          if ($h -ne [IntPtr]::Zero) {
            $sb = New-Object System.Text.StringBuilder 512
            [void]$W::GetWindowText($h, $sb, 512)
            $t = $sb.ToString()
            if ($t -ne $lastTitle) { $lastTitle = $t; Write-Output ('LOG titre de la fenetre : ' + $t) }
            if ($t -match $env:CL_READY) { $logHitAt = $now; Write-Output 'LOG le titre annonce le jeu' }
          }
        }
        if ($null -ne $logHitAt -and ($now - $logHitAt).TotalMilliseconds -ge $settle) { $ready = $true; Write-Output 'READY' }
      }
      # Dès que la fenêtre existe : titre du jeu et jaquette comme icône (barre des tâches, Alt+Tab),
      # pas le nom de l'émulateur. Fait après la lecture du titre ci-dessus, qui sert à repérer le jeu.
      if (($now - $lastDress).TotalMilliseconds -gt $(if ($ready) { 1000 } else { 250 })) {
        $h = $W::LargestWindowOf($pids)
        if ($h -ne [IntPtr]::Zero) {
          [void]$W::SetWindowText($h, $env:CL_TITLE)
          if ($icon -ne [IntPtr]::Zero) {
            [void]$W::SendMessage($h, 0x80, [IntPtr]1, $icon)
            [void]$W::SendMessage($h, 0x80, [IntPtr]0, $icon)
          }
        }
        $lastDress = $now
      }
    } else {
      $h = $W::LargestWindowOf($pids)
      if ($h -ne [IntPtr]::Zero) {
        if ($null -eq $firstWindow) { $firstWindow = $now }
        if (($now - $firstWindow).TotalSeconds -lt 25) {
          $ok = Set-Borderless $h
          if ($ok -and -not $ready) { $ready = $true; Write-Output 'READY' }
        }
        if (($now - $lastDress).TotalMilliseconds -gt 1000) {
          [void]$W::SetWindowText($h, $env:CL_TITLE)
          if ($icon -ne [IntPtr]::Zero) {
            [void]$W::SendMessage($h, 0x80, [IntPtr]1, $icon)
            [void]$W::SendMessage($h, 0x80, [IntPtr]0, $icon)
          }
          $lastDress = $now
        }
      }
    }
  }
  Start-Sleep -Milliseconds 30
}
`

/**
 * Démarre le processus auxiliaire ; `onReady` est appelé quand le jeu est affiché.
 * `watch` : jeu lancé par un émulateur (voir `EmulatorWatch`) ; absent : jeu normal.
 */
export function startWindowDresser(
  dir: string,
  title: string,
  iconPng: string | null,
  onReady: () => void = () => undefined,
  watch?: EmulatorWatch,
  onLog: (line: string) => void = () => undefined
): ChildProcess {
  const child = spawn(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-EncodedCommand', encode(DRESSER_SCRIPT)],
    {
      env: {
        ...process.env,
        CL_DIR: dir,
        CL_TITLE: title,
        CL_ICON: iconPng ?? '',
        CL_EMU: watch ? '1' : '',
        CL_READY: watch?.readyTitle ?? '',
        CL_LOG: watch?.readyLog ?? '',
        CL_LOGPAT: watch?.readyPattern ?? '',
        CL_SETTLE: String(watch?.settleMs ?? 0),
        CL_DIALOG: watch?.dialogPattern ?? ''
      },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore']
    }
  )
  let notified = false
  let pending = ''
  child.stdout?.on('data', (chunk: Buffer) => {
    pending += String(chunk)
    let nl: number
    while ((nl = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, nl).trim()
      pending = pending.slice(nl + 1)
      if (line === 'READY') {
        if (!notified) {
          notified = true
          onReady()
        }
      } else if (line.startsWith('LOG ')) {
        onLog(line.slice(4))
      }
    }
  })
  return child
}

/**
 * Surveille les manettes (XInput, lecture seule) : Retour (Back) et Menu (Start) maintenus ensemble pendant 2 secondes
 * écrivent QUIT. Fonctionne même quand la fenêtre du lanceur est cachée, ce que l'API manette du navigateur ne permet pas.
 */
const QUIT_WATCHER_SCRIPT = String.raw`Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class XI {
  [StructLayout(LayoutKind.Sequential)] public struct GP { public ushort Buttons; public byte LT, RT; public short LX, LY, RX, RY; }
  [StructLayout(LayoutKind.Sequential)] public struct ST { public uint Packet; public GP Pad; }
  [DllImport("xinput1_4.dll")] static extern uint XInputGetState(uint i, out ST s);
  public static bool Combo() {
    for (uint i = 0; i < 4; i++) {
      ST s;
      if (XInputGetState(i, out s) == 0 && (s.Pad.Buttons & 0x30) == 0x30) return true;
    }
    return false;
  }
}
'@
$held = $null
while ($true) {
  $on = $false
  try { $on = [XI]::Combo() } catch { }
  if ($on) {
    if ($null -eq $held) { $held = Get-Date }
    elseif (((Get-Date) - $held).TotalSeconds -ge 2) { Write-Output 'QUIT'; $held = $null; Start-Sleep -Seconds 4 }
  } else { $held = $null }
  Start-Sleep -Milliseconds 100
}
`

/** Arrête tout ce qui tourne dans le dossier du jeu. */
function killProcessesUnder(dir: string): Promise<void> {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-EncodedCommand', encode(UNDER_DIR + 'Get-GameProcs | Stop-Process -Force -ErrorAction SilentlyContinue')],
      { env: { ...process.env, CL_DIR: dir }, windowsHide: true },
      () => resolve()
    )
  })
}

export class Launcher {
  private running: string | null = null
  private stopCurrent: (() => void) | null = null

  /** `onWindowReady` : le jeu est affiché ; `onLog` : traces du suivi, pour le journal du lanceur. */
  constructor(
    private emit: (state: GameState) => void,
    private onWindowReady: () => void = () => undefined,
    private onLog: (line: string) => void = () => undefined
  ) {}

  get isRunning(): boolean {
    return this.running !== null
  }

  /** Arrête le jeu en cours (et tout ce qui tourne dans son dossier) : le lanceur revient au menu. */
  stop(): void {
    this.stopCurrent?.()
  }

  /** `iconPng` : image carrée (PNG) à donner à la fenêtre du jeu, ou null. */
  launch(game: ScannedGame, iconPng: string | null = null): void {
    if (this.running) return
    const exe = game.exePath ?? join(game.dir, game.exe)
    if (!existsSync(exe)) {
      this.emit({ status: 'error', id: game.id, message: `Exécutable introuvable : ${exe}` })
      return
    }

    this.running = game.id
    this.emit({ status: 'running', id: game.id })
    const started = Date.now()
    let settled = false
    let dresser: ChildProcess | null = null
    let quitWatcher: ChildProcess | null = null
    const finish = (state: GameState): void => {
      if (settled) return
      settled = true
      dresser?.kill()
      quitWatcher?.kill()
      this.stopCurrent = null
      this.running = null
      this.emit(state)
    }

    const child = spawn(exe, game.args, { cwd: game.dir, stdio: 'ignore', shell: false })
    dresser = startWindowDresser(
      game.dir,
      game.title,
      iconPng,
      () => {
        if (!settled) this.onWindowReady()
      },
      game.emulated ? game.watch : undefined,
      this.onLog
    )
    dresser.once('error', () => {
      // La surveillance de la fenêtre est facultative : le jeu tourne quand même.
    })
    // Combinaison manette (Retour + Menu, 2 s) : même effet que l'arrêt demandé par le lanceur.
    quitWatcher = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encode(QUIT_WATCHER_SCRIPT)], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore']
    })
    quitWatcher.once('error', () => undefined)
    this.stopCurrent = () => {
      this.onLog('arrêt du jeu demandé')
      child.kill()
      void killProcessesUnder(game.dir)
    }
    quitWatcher.stdout?.on('data', (chunk: Buffer) => {
      if (String(chunk).includes('QUIT')) this.stopCurrent?.()
    })
    child.once('error', (err) => {
      finish({ status: 'error', id: game.id, message: `Lancement impossible : ${err.message}` })
    })
    child.once('exit', async (code) => {
      // Le processus lancé peut n'être qu'un relais : on attend que plus rien ne tourne dans le dossier.
      let sawGame = false
      while ((await countProcessesUnder(game.dir)) > 0) {
        sawGame = true
        await sleep(POLL_MS)
      }
      if (!sawGame && code !== 0 && Date.now() - started < 5000) {
        finish({
          status: 'error',
          id: game.id,
          message: `Le jeu s'est fermé immédiatement (code ${code}).`
        })
      } else {
        finish({ status: 'idle' })
      }
    })
  }
}
