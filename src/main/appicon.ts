import { execFile } from 'child_process'

/**
 * Icône Windows d'un programme ou d'une application du menu Démarrer (celle qu'on voit sur le bureau), en PNG 256 px
 * avec transparence. `CL_ICONS` : lignes « cible|fichier.png » ; une cible est un chemin ou « shell:AppsFolder\<id> ».
 */
const SCRIPT = String.raw`Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System; using System.Drawing; using System.Drawing.Imaging; using System.Runtime.InteropServices;
public static class AppIcon {
  [StructLayout(LayoutKind.Sequential)] struct SIZE { public int cx, cy; }
  [ComImport, Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IShellItemImageFactory { [PreserveSig] int GetImage(SIZE size, int flags, out IntPtr hbm); }
  [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
  static extern void SHCreateItemFromParsingName(string path, IntPtr pbc, [MarshalAs(UnmanagedType.LPStruct)] Guid riid, [MarshalAs(UnmanagedType.Interface)] out IShellItemImageFactory item);
  [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr h);
  public static void Save(string target, string file) {
    IShellItemImageFactory f;
    SHCreateItemFromParsingName(target, IntPtr.Zero, typeof(IShellItemImageFactory).GUID, out f);
    IntPtr h;
    // 0x4 = icône seulement (pas de miniature du contenu).
    Marshal.ThrowExceptionForHR(f.GetImage(new SIZE { cx = 256, cy = 256 }, 0x4, out h));
    try {
      using (Bitmap raw = Image.FromHbitmap(h)) {
        // FromHbitmap oublie la transparence : on relit les mêmes octets comme une image avec canal alpha.
        BitmapData d = raw.LockBits(new Rectangle(0, 0, raw.Width, raw.Height), ImageLockMode.ReadOnly, raw.PixelFormat);
        try {
          using (Bitmap argb = new Bitmap(d.Width, d.Height, d.Stride, PixelFormat.Format32bppArgb, d.Scan0)) argb.Save(file, ImageFormat.Png);
        } finally { raw.UnlockBits(d); }
      }
    } finally { DeleteObject(h); }
  }
}
'@
# Application du Store (Fortnite, jeux Xbox…) : Windows ne donne qu'une icône de 44 px. Le paquet contient ses propres
# logos en grand : on prend le plus grand logo carré déclaré dans son manifeste (image d'origine, ni agrandie ni déformée).
$packages = $null
function Get-PackageLogo($appId) {
  if ($null -eq $script:packages) { $script:packages = @(Get-AppxPackage) }
  $pkg = $script:packages | Where-Object { $_.PackageFamilyName -eq $appId.Split('!')[0] } | Select-Object -First 1
  if (-not $pkg) { return $null }
  [xml]$m = Get-Content -LiteralPath (Join-Path $pkg.InstallLocation 'AppxManifest.xml')
  $best = $null; $bestW = 0
  $refs = $m.GetElementsByTagName('*') | ForEach-Object { $_.Attributes } | Where-Object { $_.Name -match 'Logo$' -and $_.Name -notmatch 'Wide' } | ForEach-Object { $_.Value } | Select-Object -Unique
  foreach ($ref in $refs) {
    $full = Join-Path $pkg.InstallLocation $ref
    # Tous les logos du même dossier : le manifeste nomme « Logo.png », mais le paquet a souvent plus grand à côté
    # (« Logo.scale-200.png », « Square480x480Logo.png »).
    $files = Get-ChildItem -LiteralPath (Split-Path $full) -Filter '*Logo*.png' -ErrorAction SilentlyContinue
    foreach ($f in $files) {
      try { $img = [Drawing.Image]::FromFile($f.FullName) } catch { continue }
      if ($img.Width -eq $img.Height -and $img.Width -gt $bestW) { $best = $f.FullName; $bestW = $img.Width }
      $img.Dispose()
    }
  }
  if ($bestW -ge 150) { return $best }
  return $null
}
foreach ($line in $env:CL_ICONS -split "\n") {
  $i = $line.LastIndexOf('|')
  if ($i -lt 1) { continue }
  $target = $line.Substring(0, $i); $file = $line.Substring($i + 1)
  try {
    # Une image (jaquette du cache de Steam) : enregistrée telle quelle en PNG, sans la redimensionner ni la déformer.
    if ($target -match '\.(jpe?g|png|bmp)$' -and (Test-Path -LiteralPath $target)) {
      $img = [Drawing.Image]::FromFile($target); $img.Save($file, [Drawing.Imaging.ImageFormat]::Png); $img.Dispose(); continue
    }
    $logo = if ($target -like 'shell:AppsFolder\*!*') { Get-PackageLogo $target.Substring(17) } else { $null }
    if ($logo) { Copy-Item -LiteralPath $logo -Destination $file -Force } else { [AppIcon]::Save($target, $file) }
  } catch { }
}
`

/** Enregistre l'icône de chaque cible dans son fichier PNG (Windows seulement ; un échec laisse le fichier absent). */
export function extractIcons(items: { target: string; file: string }[]): Promise<void> {
  if (process.platform !== 'win32' || items.length === 0) return Promise.resolve()
  return new Promise((resolve) =>
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(SCRIPT, 'utf16le').toString('base64')],
      { env: { ...process.env, CL_ICONS: items.map((i) => `${i.target}|${i.file}`).join('\n') }, windowsHide: true, timeout: 30000 },
      () => resolve()
    )
  )
}
