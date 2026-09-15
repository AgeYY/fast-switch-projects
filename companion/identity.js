'use strict';
// Preserve workspace-file identity and SSH authority, even with shared folders.
function targetUri(vscode, value) {
    let uri = vscode.Uri.parse(value);
    const current = vscode.workspace.workspaceFile || vscode.workspace.workspaceFolders?.[0]?.uri;
    const remote = current?.scheme === 'vscode-remote' ? current : vscode.workspace.workspaceFolders?.find(f => f.uri.scheme === 'vscode-remote')?.uri;
    if (uri.scheme === 'file' && remote) uri = uri.with({ scheme: remote.scheme, authority: remote.authority });
    return uri;
}
function identity(uri) {
    const text = uri.toString();
    return uri.scheme === 'file' && process.platform === 'win32' ? text.toLowerCase() : text;
}
module.exports = { targetUri, identity };
