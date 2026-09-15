param(
    [Parameter(Mandatory=$true)][string]$EngineVsix,
    [string]$OutputPath
)
$ErrorActionPreference = 'Stop'
if (-not $OutputPath) { $OutputPath = Join-Path $PSScriptRoot '..\prototype\results\fast-switch-projects-windows-0.2.0.vsix' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$enginePath = (Resolve-Path -LiteralPath $EngineVsix).Path
$archive = [IO.Compression.ZipFile]::OpenRead($enginePath)
try {
    $entry = $archive.GetEntry('extension/package.json')
    if (-not $entry) { throw 'The engine VSIX has no extension manifest.' }
    $reader = New-Object IO.StreamReader($entry.Open())
    try { $manifest = $reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose() }
} finally { $archive.Dispose() }
if ($manifest.name -ne 'fast-switch-projects' -or $manifest.publisher -ne 'ZeyuanYe') { throw 'Unexpected project engine identity.' }
if ($manifest.extensionKind.Count -ne 1 -or $manifest.extensionKind[0] -ne 'workspace') { throw 'The engine must run in the workspace host.' }
$bundlePath = Join-Path $PSScriptRoot 'bundled'
New-Item -ItemType Directory -Force -Path $bundlePath | Out-Null
Copy-Item -LiteralPath $enginePath -Destination (Join-Path $bundlePath 'engine.vsix') -Force
$metadata = @{ id = 'ZeyuanYe.fast-switch-projects'; version = $manifest.version; sha256 = (Get-FileHash -LiteralPath $enginePath -Algorithm SHA256).Hash.ToLowerInvariant() }
[IO.File]::WriteAllText((Join-Path $bundlePath 'engine.json'), ($metadata | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
if (-not (Test-Path -LiteralPath "$PSScriptRoot\bin\FspWindows.exe")) { & "$PSScriptRoot\build.ps1" }
$outputFile = [IO.Path]::GetFullPath($OutputPath)
New-Item -ItemType Directory -Force -Path ([IO.Path]::GetDirectoryName($outputFile)) | Out-Null
Push-Location $PSScriptRoot
try {
    & npx.cmd @vscode/vsce package --no-dependencies --out $outputFile
    if ($LASTEXITCODE -ne 0) { throw 'Windows package build failed.' }
} finally { Pop-Location }
