param(
    [Parameter(Mandatory = $true)][string]$RuntimeRoot,
    [Parameter(Mandatory = $true)][string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
$repository = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content -LiteralPath (Join-Path $repository 'runtime/languagetool-community.json') -Raw | ConvertFrom-Json
$runtime = (Resolve-Path -LiteralPath $RuntimeRoot).Path
$output = [IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $output) { throw 'Use um diretório de medição novo.' }
$java = Join-Path $runtime $manifest.java.executable
$jar = Join-Path $runtime $manifest.snapshot.jar
foreach ($component in @(@{ Path = $java; Hash = $manifest.java.componentChecksum }, @{ Path = $jar; Hash = $manifest.snapshot.componentChecksum })) {
    if ((Get-FileHash -LiteralPath $component.Path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $component.Hash.Replace('sha256:', '')) {
        throw 'Componente divergente do manifesto.'
    }
}
New-Item -ItemType Directory -Path $output | Out-Null
$inputPath = Join-Path $output 'autoral.txt'
$text = 'Nós vai analizar o documento. Este relatóriu tem um erro.'
[IO.File]::WriteAllText($inputPath, $text, [Text.UTF8Encoding]::new($false))
$runs = @()
for ($run = 1; $run -le 3; $run++) {
    $stdout = Join-Path $output "resultado-$run.json"
    $stderr = Join-Path $output "stderr-$run.log"
    $arguments = '-Xmx768m -jar "{0}" --json -l pt-BR -c utf-8 --clean-overlapping "{1}"' -f $jar, $inputPath
    $watch = [Diagnostics.Stopwatch]::StartNew()
    $process = Start-Process -FilePath $java -ArgumentList $arguments -WorkingDirectory (Split-Path -Parent $jar) -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
    # PowerShell 5.1 perde ExitCode após Refresh sem manter o handle do processo.
    $null = $process.Handle
    $peak = 0L
    while (-not $process.HasExited) {
        $process.Refresh()
        if (-not $process.HasExited) { $peak = [Math]::Max($peak, $process.PeakWorkingSet64) }
        if ($watch.Elapsed.TotalSeconds -gt 45) { $process.Kill(); throw 'Ensaio excedeu 45 segundos.' }
        Start-Sleep -Milliseconds 100
    }
    $process.WaitForExit()
    $watch.Stop()
    if ($process.ExitCode -ne 0) { throw "LanguageTool falhou no ensaio $run." }
    $result = Get-Content -LiteralPath $stdout -Raw | ConvertFrom-Json
    $rules = @($result.matches | ForEach-Object { $_.rule.id })
    if ($result.language.code -ne 'pt-BR' -or $rules.Count -ne 3 -or $rules -notcontains 'GENERAL_VERB_AGREEMENT_ERRORS' -or @($rules | Where-Object { $_ -eq 'MORFOLOGIK_RULE_PT_BR' }).Count -ne 2) {
        throw 'Resultado do corpus autoral diverge das três referências esperadas.'
    }
    $runs += [ordered]@{ run = $run; state = $(if ($run -eq 1) { 'primeira chamada da sessão' } else { 'repetição na mesma sessão' }); elapsedMs = $watch.ElapsedMilliseconds; peakObservedWorkingSetBytes = $peak; exitCode = $process.ExitCode; matches = $rules.Count; rules = $rules }
    $process.Dispose()
}
$system = Get-CimInstance Win32_OperatingSystem
$processor = Get-CimInstance Win32_Processor | Select-Object -First 1
$report = [ordered]@{
    date = [DateTime]::UtcNow.ToString('o'); snapshot = $manifest.snapshot.version
    os = $system.Caption; osVersion = $system.Version; visibleMemoryKiB = $system.TotalVisibleMemorySize
    cpu = $processor.Name; logicalProcessors = $processor.NumberOfLogicalProcessors
    corpusSha256 = (Get-FileHash -LiteralPath $inputPath -Algorithm SHA256).Hash.ToLowerInvariant()
    runtimeBytes = (Get-ChildItem -LiteralPath $runtime -Recurse -File | Measure-Object Length -Sum).Sum
    archiveBytes = $manifest.snapshot.size + $manifest.java.size
    definition = 'Fria: primeira chamada da sessão de ensaio. Quente: repetições sem reiniciar a sessão. Cada chamada inicia JVM nova; cache do SO não foi esvaziado. Pico observado por processo Java, não memória global simultânea.'
    baseline = 'Snapshot anterior indisponível no endereço fixado e sem cópia local. Não há comparação de qualidade linguística entre versões; adoção local autorizada para restaurar disponibilidade conforme ADR-018.'
    runs = $runs
}
$report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $output 'medicao.json') -Encoding utf8
$report | ConvertTo-Json -Depth 10
