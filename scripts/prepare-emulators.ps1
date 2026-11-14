# Télécharge les émulateurs libres des jeux Pokémon depuis les pages officielles de leurs auteurs
# (GitHub, onglet Releases) et les range dans emulators-src\ (dossier local, ignoré par git) :
#   win\mgba, win\melonds, win\azahar   (Windows)
#   linux\mgba.AppImage, linux\melonds\..., linux\azahar.AppImage   (Linux)
# Aucun jeu, BIOS ni clé. Dolphin (XD) n'est pas livré : voir docs/emulateurs-pokemon.md.
$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot '..\emulators-src'
$tmp = Join-Path $root '_tmp'
New-Item -ItemType Directory -Force $tmp, "$root\win", "$root\linux" | Out-Null

function Get-File($url, $name) {
  $out = Join-Path $tmp $name
  if (-not (Test-Path $out)) { Write-Host "télécharge $name"; Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing }
  return $out
}
function Unpack($archive, $dest) {
  if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
  New-Item -ItemType Directory -Force $dest | Out-Null
  & (Join-Path $env:SystemRoot 'System32\tar.exe') -xf $archive -C $dest
  # Un seul sous-dossier : on le remonte d'un niveau.
  $kids = Get-ChildItem $dest
  if ($kids.Count -eq 1 -and $kids[0].PSIsContainer) {
    Get-ChildItem $kids[0].FullName | Move-Item -Destination $dest
    Remove-Item $kids[0].FullName -Recurse -Force
  }
}

$mgba = 'https://github.com/mgba-emu/mgba/releases/download/0.10.5'
$melon = 'https://github.com/melonDS-emu/melonDS/releases/download/1.1'
$azahar = 'https://github.com/azahar-emu/azahar/releases/download/2126.2'

# Windows
Unpack (Get-File "$mgba/mGBA-0.10.5-win64.7z" 'mgba-win.7z') "$root\win\mgba"
Unpack (Get-File "$melon/melonDS-1.1-windows-x86_64.zip" 'melonds-win.zip') "$root\win\melonds"
Unpack (Get-File "$azahar/azahar-windows-msvc-2126.2.zip" 'azahar-win.zip') "$root\win\azahar"

# Linux (AppImage)
Copy-Item (Get-File "$mgba/mGBA-0.10.5-appimage-x64.appimage" 'mgba.AppImage') "$root\linux\mgba.AppImage" -Force
Copy-Item (Get-File "$azahar/azahar.AppImage" 'azahar.AppImage') "$root\linux\azahar.AppImage" -Force
Unpack (Get-File "$melon/melonDS-1.1-appimage-x86_64.zip" 'melonds-linux.zip') "$root\linux\melonds"

Remove-Item $tmp -Recurse -Force
Write-Host 'ok'
