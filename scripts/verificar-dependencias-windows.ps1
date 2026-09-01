$ErrorActionPreference = "Stop"

function Obter-SaidaCargo {
    param([string[]]$Argumentos)

    $preferenciaAnterior = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $saida = & cargo @Argumentos 2>&1 | Out-String
    $codigoSaida = $LASTEXITCODE
    $ErrorActionPreference = $preferenciaAnterior
    if ($codigoSaida -ne 0) {
        throw $saida.Trim()
    }

    return $saida
}

function Confirmar-VersaoMinima {
    param(
        [object[]]$Pacotes,
        [string]$Nome,
        [version]$Minima
    )

    $versoes = @($Pacotes | Where-Object { $_.name -eq $Nome } | ForEach-Object { [version]$_.version })
    if ($versoes.Count -eq 0) {
        throw "A dependência $Nome não foi encontrada no lockfile."
    }

    foreach ($versao in $versoes) {
        if ($versao -lt $Minima) {
            throw "A dependência $Nome permanece na versão vulnerável $versao; mínimo: $Minima."
        }
    }

    Write-Output "${Nome}: $($versoes -join ', ')"
}

$metadataJson = & cargo metadata --locked --format-version 1
if ($LASTEXITCODE -ne 0) {
    throw "Falha ao ler o metadata Cargo bloqueado."
}
$metadata = $metadataJson | ConvertFrom-Json

Confirmar-VersaoMinima -Pacotes $metadata.packages -Nome "time" -Minima "0.3.47"
Confirmar-VersaoMinima -Pacotes $metadata.packages -Nome "serde_with" -Minima "3.21.0"

$grafoWindows = Obter-SaidaCargo @(
    "tree", "--locked", "--workspace", "--target", "x86_64-pc-windows-msvc"
)
if ($grafoWindows -notmatch "webview2-com v") {
    throw "A cadeia WebView2 não foi encontrada no grafo Windows."
}
if ($grafoWindows -match "\bglib v") {
    throw "Uma dependência glib apareceu indevidamente no grafo Windows."
}

$grafoGlibLinux = Obter-SaidaCargo @(
    "tree", "--locked", "--workspace", "--target", "x86_64-unknown-linux-gnu",
    "--invert", "glib@0.18.5"
)
if ($grafoGlibLinux -notmatch "glib v0\.18\.5") {
    throw "A exceção glib 0.18.5 deixou de ser identificável na cadeia Linux; revise a documentação."
}

Write-Output "Windows: WebView2 presente e glib 0.18.5 ausente."
Write-Output "Linux congelado: glib 0.18.5 permanece na cadeia GTK3/WebKitGTK e fora do Windows."
