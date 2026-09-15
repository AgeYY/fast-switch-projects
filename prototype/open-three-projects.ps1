param(
    [string]$SshHost = 'weixx2',
    [string]$ProfileName = 'cursor',
    [string]$RemoteRoot = '/home/zeyuan/ordered-projects-single-visible-window/prototype/results/three-projects'
)
$ErrorActionPreference = 'Stop'
foreach ($projectName in @('A', 'B', 'C')) {
    $workspaceUri = "vscode-remote://ssh-remote+$SshHost$RemoteRoot/FSP-$projectName.code-workspace"
    & code.cmd --profile $ProfileName --new-window --file-uri $workspaceUri
    if ($LASTEXITCODE -ne 0) { throw "VS Code could not open project $projectName" }
}
