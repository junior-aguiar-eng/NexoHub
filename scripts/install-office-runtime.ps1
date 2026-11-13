param(
  [string]$RuntimeDir = (Join-Path (Split-Path -Parent $PSScriptRoot) "runtime\office"),
  [string]$Version = "25.8.2",
  [string]$ZipUrl = "",
  [string]$ExpectedSha256 = ""
)

$ErrorActionPreference = "Stop"

Write-Host "Preparando Superpoder Office (LibreOffice portátil $Version) em: $RuntimeDir"
New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

$sofficePath = Join-Path $RuntimeDir "program\soffice.exe"
if (Test-Path $sofficePath) {
  Write-Host "Superpoder Office já instalado em: $sofficePath"
  exit 0
}

if ([string]::IsNullOrWhiteSpace($ZipUrl) -or [string]::IsNullOrWhiteSpace($ExpectedSha256)) {
  Write-Host @"
Uso para instalação verificada por hash SHA-256 (Windows x64):
  .\scripts\install-office-runtime.ps1 `
    -ZipUrl "https://downloadarchive.documentfoundation.org/libreoffice/old/..." `
    -ExpectedSha256 "<SHA256_OFICIAL_DO_PACOTE>"
"@
  exit 1
}

$tempZip = Join-Path ([System.IO.Path]::GetTempPath()) ("nexohub-office-" + [Guid]::NewGuid().ToString() + ".zip")
try {
  Write-Host "Baixando pacote oficial..."
  Invoke-WebRequest -Uri $ZipUrl -OutFile $tempZip -UseBasicParsing
  $actualHash = (Get-FileHash -Path $tempZip -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualHash -ne $ExpectedSha256.ToLowerInvariant()) {
    throw "Violação de integridade SHA-256! Esperado: $ExpectedSha256 | Calculado: $actualHash"
  }
  Write-Host "Checksum SHA-256 verificado. Extraindo para $RuntimeDir..."
  Expand-Archive -Path $tempZip -DestinationPath $RuntimeDir -Force
} finally {
  if (Test-Path $tempZip) { Remove-Item -Force $tempZip }
}
