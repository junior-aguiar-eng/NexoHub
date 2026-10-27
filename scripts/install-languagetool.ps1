param(
    [Parameter(Mandatory = $true)][string]$InstallRoot,
    [string]$ManifestPath,
    [string]$InventoryPath,
    [string]$JavaInventoryPath,
    [string]$ArchiveDirectory,
    [string]$LogPath
)

$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSEdition -eq 'Desktop') {
    # Somente este processo: evitar herdar módulos do PowerShell 7 no Windows PowerShell 5.1.
    $windowsModules = Join-Path $env:WINDIR 'System32/WindowsPowerShell/v1.0/Modules'
    $env:PSModulePath = $windowsModules + [IO.Path]::PathSeparator + $env:PSModulePath
}
$repositoryRoot = Split-Path -Parent $PSScriptRoot
if (-not $ManifestPath) { $ManifestPath = Join-Path $repositoryRoot 'runtime/languagetool-community.json' }
if (-not $InventoryPath) { $InventoryPath = Join-Path $repositoryRoot 'docs/quality/languagetool-20261027-jars.json' }
if (-not $JavaInventoryPath) { $JavaInventoryPath = Join-Path $repositoryRoot 'docs/quality/languagetool-java-21.0.12.1-files.json' }
$target = [IO.Path]::GetFullPath($InstallRoot).TrimEnd('\', '/')
$parent = Split-Path -Parent $target
$temporaryRoot = $null
$stage = $null

function Write-InstallLog([string]$Message) {
    Write-Output $Message
    if ($LogPath) { Add-Content -LiteralPath $LogPath -Value ((Get-Date -Format o) + ' ' + $Message) -Encoding UTF8 }
}

function Resolve-RuntimePath([string]$Root, [string]$Relative) {
    $base = [IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
    if ([IO.Path]::IsPathRooted($Relative) -or (@($Relative -split '[\\/]') -contains '..')) {
        throw 'LT_INSTALL_INVALID_MANIFEST: caminho relativo inválido.'
    }
    $resolved = [IO.Path]::GetFullPath((Join-Path $base $Relative))
    if (-not $resolved.StartsWith($base + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'LT_INSTALL_INVALID_MANIFEST: caminho fora do runtime.'
    }
    $cursor = $resolved
    while ($cursor.Length -ge $base.Length) {
        if ((Test-Path -LiteralPath $cursor) -and ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw 'LT_INSTALL_INVALID_RUNTIME: link ou junction não permitido.'
        }
        if ($cursor -eq $base) { break }
        $cursor = Split-Path -Parent $cursor
    }
    return $resolved
}

function Assert-Runtime([string]$Root) {
    if (-not (Test-Path -LiteralPath $Root -PathType Container)) { throw 'LT_INSTALL_INVALID_RUNTIME: diretório ausente.' }
    if ($javaInventory.count -le 0 -or @($javaInventory.files).Count -ne $javaInventory.count) { throw 'LT_INSTALL_INVALID_MANIFEST: inventário Java vazio ou divergente.' }
    $javaFiles = @{}
    foreach ($file in $javaInventory.files) {
        if ($javaFiles.ContainsKey($file.file)) { throw 'LT_INSTALL_INVALID_MANIFEST: arquivo Java duplicado.' }
        $javaFiles[$file.file] = $true
        $path = Resolve-RuntimePath $Root ('java/' + $file.file)
        if ((Get-Item -LiteralPath $path).Length -ne $file.bytes -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $file.sha256) {
            throw "LT_INSTALL_INVALID_RUNTIME: arquivo Java divergente: $($file.file)"
        }
    }
    foreach ($component in @(
        @{ Path = $manifest.snapshot.jar; Hash = $manifest.snapshot.componentChecksum },
        @{ Path = $manifest.java.executable; Hash = $manifest.java.componentChecksum }
    )) {
        $path = Resolve-RuntimePath $Root $component.Path
        if ('sha256:' + (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $component.Hash) {
            throw "LT_INSTALL_INVALID_RUNTIME: componente divergente: $($component.Path)"
        }
    }
    foreach ($relative in @($manifest.snapshot.licenseFile, $manifest.snapshot.thirdPartyLicenses, $manifest.java.licenseFile, $manifest.java.assemblyException)) {
        if (-not (Test-Path -LiteralPath (Resolve-RuntimePath $Root $relative) -PathType Leaf)) {
            throw "LT_INSTALL_INVALID_RUNTIME: aviso de licença ausente: $relative"
        }
    }
    $snapshotRoot = Resolve-RuntimePath $Root 'languagetool'
    $expected = @{}
    foreach ($jar in $inventory.jars) {
        if ($expected.ContainsKey($jar.file)) { throw 'LT_INSTALL_INVALID_MANIFEST: JAR duplicado.' }
        $expected[$jar.file] = $true
        $path = Resolve-RuntimePath $snapshotRoot $jar.file
        if ((Get-Item -LiteralPath $path).Length -ne $jar.bytes -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $jar.sha256) {
            throw "LT_INSTALL_INVALID_RUNTIME: JAR divergente: $($jar.file)"
        }
    }
    $pending = New-Object 'System.Collections.Generic.Stack[string]'
    $pending.Push($snapshotRoot)
    $jarCount = 0
    while ($pending.Count -gt 0) {
        foreach ($entry in Get-ChildItem -LiteralPath $pending.Pop() -Force) {
            if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'LT_INSTALL_INVALID_RUNTIME: link no runtime.' }
            if ($entry.PSIsContainer) { $pending.Push($entry.FullName) }
            elseif ($entry.Extension -ieq '.jar') { $jarCount++ }
        }
    }
    if ($jarCount -ne $inventory.count -or $expected.Count -ne $inventory.count) { throw 'LT_INSTALL_INVALID_RUNTIME: conjunto de JARs divergente.' }
}

function Receive-Archive($Component, [string]$Destination) {
    if ($ArchiveDirectory) {
        Copy-Item -LiteralPath (Join-Path $ArchiveDirectory ([IO.Path]::GetFileName($Component.archive))) -Destination $Destination
    } else {
        $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
        if (-not $curl) { throw 'LT_INSTALL_DOWNLOAD_UNAVAILABLE: curl do Windows não encontrado.' }
        & $curl.Source --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --retry 2 --connect-timeout 20 --max-time 600 --output $Destination $Component.source
        if ($LASTEXITCODE -ne 0) { throw "LT_INSTALL_DOWNLOAD_FAILED: download falhou ($LASTEXITCODE)." }
    }
    if ((Get-Item -LiteralPath $Destination).Length -ne $Component.size -or 'sha256:' + (Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash.ToLowerInvariant() -ne $Component.checksum) {
        throw 'LT_INSTALL_ARCHIVE_CORRUPT: tamanho ou checksum do arquivo inválido.'
    }
}

try {
    $manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
    $inventory = Get-Content -LiteralPath $InventoryPath -Raw | ConvertFrom-Json
    $javaInventory = Get-Content -LiteralPath $JavaInventoryPath -Raw | ConvertFrom-Json
    if ('sha256:' + $javaInventory.sourceZipSha256 -ne $manifest.java.checksum) { throw 'LT_INSTALL_INVALID_MANIFEST: origem Java divergente.' }
    if ('sha256:' + $inventory.sourceZipSha256 -ne $manifest.snapshot.checksum -or $inventory.count -ne @($inventory.jars).Count) {
        throw 'LT_INSTALL_INVALID_MANIFEST: inventário não corresponde ao snapshot.'
    }
    if (Test-Path -LiteralPath $target) {
        try { Assert-Runtime $target }
        catch { throw "LT_INSTALL_CONFLICT: instalação existente preservada; $($_.Exception.Message)" }
        Write-InstallLog 'LanguageTool já presente; componentes e inventário conferidos. Nenhum download realizado.'
        exit 0
    }
    $temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) ('NexoHub-LanguageTool-' + [Guid]::NewGuid().ToString('N'))
    $downloads = Join-Path $temporaryRoot 'downloads'
    $expanded = Join-Path $temporaryRoot 'expanded'
    New-Item -ItemType Directory -Path $downloads, $expanded | Out-Null
    $snapshotArchive = Join-Path $downloads 'snapshot.zip'
    $javaArchive = Join-Path $downloads 'java.zip'
    Write-InstallLog 'Preparando LanguageTool oficial; conferindo arquivos antes da instalação.'
    Receive-Archive $manifest.snapshot $snapshotArchive
    Receive-Archive $manifest.java $javaArchive
    # O módulo Archive de alguns Windows limpos não contém recursos pt-BR.
    # A API .NET nativa independe desse módulo e recusa entradas fora do destino.
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::ExtractToDirectory($snapshotArchive, (Join-Path $expanded 'snapshot'))
    [IO.Compression.ZipFile]::ExtractToDirectory($javaArchive, (Join-Path $expanded 'java'))
    $snapshotSources = @(Get-ChildItem -LiteralPath (Join-Path $expanded 'snapshot') -Directory)
    $javaSources = @(Get-ChildItem -LiteralPath (Join-Path $expanded 'java') -Directory)
    if ($snapshotSources.Count -ne 1 -or $javaSources.Count -ne 1) { throw 'LT_INSTALL_ARCHIVE_STRUCTURE: estrutura inesperada.' }
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
    $stage = Join-Path $parent ('NexoHub-LanguageTool-stage-' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $stage | Out-Null
    Copy-Item -LiteralPath $snapshotSources[0].FullName -Destination (Join-Path $stage 'languagetool') -Recurse
    Copy-Item -LiteralPath $javaSources[0].FullName -Destination (Join-Path $stage 'java') -Recurse
    Assert-Runtime $stage
    [IO.Directory]::Move($stage, $target)
    Write-InstallLog "LanguageTool Community pt-BR instalado e conferido em $target"
} catch {
    Write-InstallLog $_.Exception.Message
    throw
} finally {
    foreach ($cleanup in @(
        @{ Path = $temporaryRoot; Parent = [IO.Path]::GetTempPath(); Pattern = '^NexoHub-LanguageTool-[a-f0-9]{32}$' },
        @{ Path = $stage; Parent = $parent; Pattern = '^NexoHub-LanguageTool-stage-[a-f0-9]{32}$' }
    )) {
        if (-not $cleanup.Path) { continue }
        $resolved = [IO.Path]::GetFullPath($cleanup.Path)
        $expectedParent = [IO.Path]::GetFullPath($cleanup.Parent).TrimEnd('\', '/')
        if ((Split-Path -Parent $resolved).TrimEnd('\', '/') -ne $expectedParent -or (Split-Path -Leaf $resolved) -notmatch $cleanup.Pattern) {
            throw 'LT_INSTALL_CLEANUP_REFUSED: diretório temporário fora do limite esperado.'
        }
        if (Test-Path -LiteralPath $resolved) { Remove-Item -LiteralPath $resolved -Recurse -Force }
    }
}
