$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force "$PSScriptRoot\bin" | Out-Null
& "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:winexe /platform:x64 /optimize+ /r:System.Web.Extensions.dll /out:"$PSScriptRoot\bin\FspWindows.exe" "$PSScriptRoot\native\Program.cs"
if ($LASTEXITCODE -ne 0) { throw 'Native helper build failed' }
