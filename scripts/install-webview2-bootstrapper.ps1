$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$destination = Join-Path $root 'target\release\runtime\MicrosoftEdgeWebview2Setup.exe'
$directory = Split-Path -Parent $destination
New-Item -ItemType Directory -Force -Path $directory | Out-Null

$url = 'https://go.microsoft.com/fwlink/p/?LinkId=2124703'
Invoke-WebRequest -Uri $url -OutFile $destination
$file = Get-Item -LiteralPath $destination
if ($file.Length -lt 100000 -or $file.Length -gt 10000000) {
    throw 'Tamanho inesperado do bootstrapper WebView2.'
}
$signature = Get-AuthenticodeSignature -LiteralPath $destination
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch '(^|,)\s*O=Microsoft Corporation(,|$)') {
    throw 'Assinatura Microsoft inválida no bootstrapper WebView2.'
}
Write-Output "WebView2 bootstrapper verificado: $($file.Length) bytes."
