# Remplit tools-src\ (dossier local, ignoré par git) avec les outils propres, sans aucun fichier de jeu :
#   pokopia, dkb-setup, eglantine, hookshot-builder. Les chemins des archives se règlent ci-dessous.
param(
  [string]$Downloads = "$env:USERPROFILE\Downloads",
  [string]$Eglantine = "$env:USERPROFILE\Desktop\eglantine-windows-x86_64"
)
$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot '..\tools-src'
New-Item -ItemType Directory -Force $root | Out-Null

function Expand-Inner($zip, $name) {
  $dest = Join-Path $root $name
  if (Test-Path $dest) { Write-Host "déjà là : $name"; return }
  $tmp = Join-Path $root "_tmp_$name"
  Expand-Archive -LiteralPath $zip -DestinationPath $tmp -Force
  $inner = Get-ChildItem $tmp -Directory | Select-Object -First 1
  # Un niveau de plus quand l'archive contient « dossier\dossier ».
  $sub = Get-ChildItem $inner.FullName -Directory | Where-Object { $_.Name -eq 'DKB-Setup' } | Select-Object -First 1
  Move-Item ($(if ($sub) { $sub.FullName } else { $inner.FullName })) $dest
  Remove-Item $tmp -Recurse -Force
  Write-Host "ok : $name"
}

Expand-Inner (Join-Path $Downloads 'PokopiaRecomp-0.11.1-win64.zip') 'pokopia'
Expand-Inner (Join-Path $Downloads 'DKB-Setup-0.3.0+a5796d9-windows.zip') 'dkb-setup'

if (-not (Test-Path (Join-Path $root 'eglantine'))) {
  Copy-Item $Eglantine (Join-Path $root 'eglantine') -Recurse
  Write-Host 'ok : eglantine'
}
$hb = Join-Path $root 'hookshot-builder'
New-Item -ItemType Directory -Force $hb | Out-Null
Copy-Item (Join-Path $Downloads 'HookshotBuilder.exe') $hb -Force
Write-Host 'ok : hookshot-builder'
