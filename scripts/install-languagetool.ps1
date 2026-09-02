param(
    [Parameter(Mandatory = $true)]
    [string]$InstallRoot
)

$ErrorActionPreference = "Stop"
$target = [System.IO.Path]::GetFullPath($InstallRoot)
if (Test-Path -LiteralPath $target) {
    throw "O diretório de destino já existe: $target"
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $repositoryRoot "runtime/languagetool-community.json"
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("NexoHub-LanguageTool-" + [Guid]::NewGuid().ToString("N"))
$stage = Join-Path $temporaryRoot "stage"
$downloads = Join-Path $temporaryRoot "downloads"
$expanded = Join-Path $temporaryRoot "expanded"

New-Item -ItemType Directory -Path $stage, $downloads, $expanded | Out-Null
try {
    $snapshotArchive = Join-Path $downloads ([System.IO.Path]::GetFileName($manifest.snapshot.archive))
    $javaArchive = Join-Path $downloads ([System.IO.Path]::GetFileName($manifest.java.archive))
    Invoke-WebRequest -Uri $manifest.snapshot.source -OutFile $snapshotArchive -UseBasicParsing
    Invoke-WebRequest -Uri $manifest.java.source -OutFile $javaArchive -UseBasicParsing

    foreach ($item in @(
        @{ Path = $snapshotArchive; Sha256 = $manifest.snapshot.checksum.Replace("sha256:", ""); Size = $manifest.snapshot.size },
        @{ Path = $javaArchive; Sha256 = $manifest.java.checksum.Replace("sha256:", ""); Size = $manifest.java.size }
    )) {
        $actualHash = (Get-FileHash -LiteralPath $item.Path -Algorithm SHA256).Hash.ToLowerInvariant()
        $actualSize = (Get-Item -LiteralPath $item.Path).Length
        if ($actualHash -ne $item.Sha256 -or $actualSize -ne $item.Size) {
            throw "Integridade inválida para $($item.Path)"
        }
    }

    $snapshotExpanded = Join-Path $expanded "snapshot"
    $javaExpanded = Join-Path $expanded "java"
    Expand-Archive -LiteralPath $snapshotArchive -DestinationPath $snapshotExpanded
    Expand-Archive -LiteralPath $javaArchive -DestinationPath $javaExpanded
    $snapshotSources = @(Get-ChildItem -LiteralPath $snapshotExpanded -Directory)
    $javaSources = @(Get-ChildItem -LiteralPath $javaExpanded -Directory)
    if ($snapshotSources.Count -ne 1 -or $javaSources.Count -ne 1) {
        throw "Estrutura inesperada nos arquivos de instalação."
    }
    $snapshotSource = $snapshotSources[0]
    $javaSource = $javaSources[0]

    Move-Item -LiteralPath $snapshotSource.FullName -Destination (Join-Path $stage "languagetool")
    Move-Item -LiteralPath $javaSource.FullName -Destination (Join-Path $stage "java")

    foreach ($component in @(
        @{ Path = $manifest.snapshot.jar; Sha256 = $manifest.snapshot.componentChecksum.Replace("sha256:", "") },
        @{ Path = $manifest.java.executable; Sha256 = $manifest.java.componentChecksum.Replace("sha256:", "") }
    )) {
        $componentPath = Join-Path $stage $component.Path
        $actualHash = (Get-FileHash -LiteralPath $componentPath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actualHash -ne $component.Sha256) {
            throw "Componente extraído não corresponde ao manifesto: $($component.Path)"
        }
    }

    foreach ($licensePath in @(
        $manifest.snapshot.licenseFile,
        $manifest.snapshot.thirdPartyLicenses,
        $manifest.java.licenseFile,
        $manifest.java.assemblyException
    )) {
        if (-not (Test-Path -LiteralPath (Join-Path $stage $licensePath) -PathType Leaf)) {
            throw "Aviso de licença ausente: $licensePath"
        }
    }

    New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
    Move-Item -LiteralPath $stage -Destination $target
    Write-Output "LanguageTool Community pt-BR instalado em $target"
} finally {
    if (Test-Path -LiteralPath $temporaryRoot) {
        Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
    }
}
