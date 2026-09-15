'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const statusCommand = 'fastSwitchProjects.engine.status';

function atLeast(actual, required) {
    const a = actual.split('.').map(Number), b = required.split('.').map(Number);
    if (a.length !== 3 || b.length !== 3 || [...a, ...b].some(n => !Number.isInteger(n) || n < 0)) return false;
    for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] > b[i]; }
    return true;
}

async function ensureEngine(vscode, bundle = path.join(__dirname, 'bundled'), options = {}) {
    const sleep = options.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
    const info = JSON.parse(fs.readFileSync(path.join(bundle, 'engine.json'), 'utf8'));
    if (info.id !== 'ZeyuanYe.fast-switch-projects' || !/^\d+\.\d+\.\d+$/.test(info.version)) throw new Error('Invalid bundled project engine metadata');
    async function ready() {
        if (!(await vscode.commands.getCommands(true)).includes(statusCommand)) return false;
        try {
            const status = await vscode.commands.executeCommand(statusCommand);
            return status && typeof status.version === 'string' && atLeast(status.version, info.version)
                && (!vscode.env.remoteName || status.kind === vscode.ExtensionKind.Workspace);
        } catch { return false; }
    }
    // Let an already installed engine finish its normal startup before installing.
    for (let n = 0; n < 8; n++) { if (await ready()) return {ready: true, installed: false}; await sleep(250); }
    const file = path.join(bundle, 'engine.vsix');
    const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    if (hash !== info.sha256) throw new Error('The bundled project engine is damaged; reinstall the Windows package');
    await vscode.window.withProgress({location: vscode.ProgressLocation.Notification, title: 'Setting up Fast Switch Projects'}, async () => {
        // VS Code selects the local/remote workspace host from the engine manifest.
        // The VSIX ships inside this package; no Marketplace download is required.
        await vscode.commands.executeCommand('workbench.extensions.installExtension', vscode.Uri.file(file));
    });
    for (let n = 0; n < 40; n++) { if (await ready()) return {ready: true, installed: true}; await sleep(250); }
    // An upgrade of an already active engine can require the normal VS Code reload.
    return {ready: false, installed: true};
}
module.exports = {ensureEngine, atLeast};
