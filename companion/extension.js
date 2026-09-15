'use strict';
const vscode = require('vscode');
const crypto = require('crypto');
const { Broker } = require('./broker');
const { Registrations } = require('./registrations');
const { ensureEngine } = require('./engineSetup');
const { targetUri, identity } = require('./identity');
const setting = 'fastSwitchProjects.singleWindow.enabled';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let broker, approvals, context, session, key, registered = false, registering, heartbeatBusy = false, output;
let operation = Promise.resolve();
function serial(fn) { const result = operation.then(fn); operation = result.catch(() => {}); return result; }
function enabled() { return vscode.workspace.getConfiguration().get(setting, false); }
function currentUri() { return vscode.workspace.workspaceFile || vscode.workspace.workspaceFolders?.[0]?.uri; }
function log(message) { output.appendLine(new Date().toISOString() + ' ' + message); }
async function fail(error) {
    log('Recovery: ' + error.message);
    try { await broker.recover(); } catch (recovery) { log('Recovery helper: ' + recovery.message); }
    vscode.window.showWarningMessage('Single window mode paused: ' + error.message + '. Use Show All Project Windows to recover.');
}
async function restoreTitle() {
    const pending = context.workspaceState.get('titleRestore');
    if (!pending) return;
    const config = vscode.workspace.getConfiguration('window');
    // Do not undo an intervening user edit.
    if (config.inspect('title')?.workspaceValue === pending.temporary) {
        await config.update('title', pending.hadValue ? pending.value : undefined, vscode.ConfigurationTarget.Workspace);
    }
    await context.workspaceState.update('titleRestore', undefined);
}
async function bind() {
    if (registered) return;
    if (registering) return registering;
    registering = (async () => {
        const uri = currentUri();
        if (!uri || uri.scheme === 'untitled') throw new Error('Save this workspace before registering it');
        key = identity(uri);
        await broker.start(); await restoreTitle();
        const config = vscode.workspace.getConfiguration('window');
        const value = config.inspect('title')?.workspaceValue;
        const challenge = crypto.randomUUID().replace(/-/g, '');
        const temporary = config.get('title') + ' [FSP:' + challenge + ']';
        await context.workspaceState.update('titleRestore', { hadValue: value !== undefined, value, temporary });
        try {
            await config.update('title', temporary, vscode.ConfigurationTarget.Workspace);
            let lastError;
            for (let n = 0; n < 20; n++) {
                await delay(150);
                try {
                    const result = await broker.request({ op: 'register', key, session, challenge });
                    if (result.pending) continue;
                    registered = true; break;
                }
                catch (error) { lastError = error; }
            }
            if (!registered) throw lastError || new Error('Timed out identifying the project window');
            log('Registered ' + key);
        } finally { await restoreTitle(); }
    })();
    try { return await registering; } finally { registering = undefined; }
}
async function switchTo(uri) {
    const started = performance.now();
    const result = await broker.request({ op: 'switch', key: identity(uri) });
    if (result.needsFocus) {
        // VS Code's main process can focus an existing workspace if Windows denies
        // the helper foreground permission. The source extension host stays alive.
        await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: true });
        await delay(80);
        await broker.request({ op: 'commit', token: result.token });
    }
    log('Switch ' + JSON.stringify({ key: identity(uri), ms: +(performance.now()-started).toFixed(1), ...result }));
    return result;
}
async function syncRegistration() {
    const uri = currentUri();
    if (!uri || uri.scheme === 'untitled') return;
    const project = identity(uri), approved = approvals.get(project);
    if (approved === false) {
        if (context.workspaceState.get('registered')) await context.workspaceState.update('registered', false);
        if (registered) await broker.request({op: 'unregister', key, session});
        registered = false;
        return;
    }
    if (approved !== true && !context.workspaceState.get('registered')) return;
    await bind();
    // An Unregister command can arrive while bind is awaiting the window title.
    if (approvals.get(project) === false) {
        await broker.request({op: 'unregister', key, session});
        registered = false;
        await context.workspaceState.update('registered', false);
        return;
    }
    if (!context.workspaceState.get('registered')) await context.workspaceState.update('registered', true);
}
async function open(value) {
    if (!enabled()) return false;
    const uri = targetUri(vscode, value);
    try {
        await broker.start();
        const result = await switchTo(uri);
        if (result.disabled) {
            await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: true });
            return true;
        }
        if (result.missing) {
            // Opening does not implicitly register an unrelated window. Previously
            // registered workspaces rebind themselves when they activate.
            await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: true });
            for (let n = 0; n < 60; n++) {
                await delay(500);
                const status = await broker.request({op: 'status'});
                if (!status.enabled) break;
                if (status.entries.some(e => e.key === identity(uri) && e.valid)) { await switchTo(uri); break; }
            }
        }
    } catch (error) { await fail(error); }
    return true;
}
async function activate(ctx) {
    if (process.platform !== 'win32') return;
    context = ctx; session = crypto.randomUUID();
    broker = new Broker(context.globalStorageUri.fsPath);
    approvals = new Registrations(context.globalStorageUri.fsPath);
    output = vscode.window.createOutputChannel('Fast Switch Projects Windows');
    context.subscriptions.push(output);
    const command = (name, fn) => context.subscriptions.push(vscode.commands.registerCommand('fastSwitchProjects.windows.' + name,
        (...args) => serial(() => fn(...args)).catch(error => fail(error))));
    command('open', open);
    command('register', async () => {
        if (currentUri()) approvals.set(identity(currentUri()), true);
        await bind(); await context.workspaceState.update('registered', true);
        if (enabled()) { await broker.request({op: 'enable'}); await switchTo(currentUri()); }
        vscode.window.showInformationMessage('This project window is registered for single window mode.');
    });
    command('unregister', async () => {
        if (currentUri()) approvals.set(identity(currentUri()), false);
        await context.workspaceState.update('registered', false);
        if (key) await broker.request({op: 'unregister', key, session});
        registered = false;
    });
    // These commands carry explicit approval from the remote project-list action.
    // Return errors to that caller instead of swallowing them in the UI wrapper.
    context.subscriptions.push(vscode.commands.registerCommand('fastSwitchProjects.windows.prepareRegistration', (values) => serial(async () => {
        if (!Array.isArray(values) || values.some(value => typeof value !== 'string')) throw new Error('Expected workspace URIs');
        const uris = values.map(value => targetUri(vscode, value));
        if (uris.some(uri => !['file', 'vscode-remote'].includes(uri.scheme))) throw new Error('Save each project workspace before registering it');
        const keys = [...new Set(uris.map(identity))];
        await broker.start(); await broker.recover();
        for (const project of keys) approvals.set(project, true);
        await syncRegistration();
        return {ok: true, keys};
    })));
    context.subscriptions.push(vscode.commands.registerCommand('fastSwitchProjects.windows.registrationStatus', async () => {
        await broker.start();
        const status = await broker.request({op: 'status'});
        return {keys: status.entries.filter(entry => entry.valid).map(entry => entry.key)};
    }));
    // Recovery must not wait behind a cold-open operation or another queued command.
    context.subscriptions.push(vscode.commands.registerCommand('fastSwitchProjects.windows.showAll', async () => {
        try { await broker.recover(); log('All managed project windows restored; hiding paused'); }
        catch (error) { await fail(error); }
    }));
    command('enable', async () => {
        if (!context.workspaceState.get('registered')) {
            const action = 'Register This Window and Enable';
            const selected = await vscode.window.showInformationMessage(
                'This window is not registered for single-window mode. The Slots list saves projects; registration allows their running windows to be hidden. Register each window you want managed. To only open the list, use Open All Listed Projects.',
                action);
            if (selected !== action) return;
            if (currentUri()) approvals.set(identity(currentUri()), true);
            await bind(); await context.workspaceState.update('registered', true);
        }
        await bind(); await vscode.workspace.getConfiguration().update(setting, true, vscode.ConfigurationTarget.Global);
        await broker.request({op: 'enable'}); await switchTo(currentUri());
    });
    command('diagnostics', async () => { await broker.start(); log(JSON.stringify(await broker.request({op:'status'}), null, 2)); output.show(); });
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
        if (!event.affectsConfiguration(setting)) return;
        if (!enabled()) { broker.recover().catch(fail); return; }
        serial(async () => {
            if (enabled() && vscode.window.state.focused && context.workspaceState.get('registered')) {
                await bind(); await broker.request({op: 'enable'}); await switchTo(currentUri());
            }
        }).catch(fail);
    }));
    await restoreTitle();
    await syncRegistration().catch(error => log('Registration pending: ' + error.message));
    const timer = setInterval(async () => {
        if (heartbeatBusy) return;
        heartbeatBusy = true;
        try {
            await syncRegistration();
            if (!registered) return;
            const r = await broker.request({op: 'beat', key, session}); if (!r.registered) registered = false;
        }
        catch (error) { registered = false; log('Heartbeat lost; watchdog will restore windows: ' + error.message); }
        finally { heartbeatBusy = false; }
    }, 2000);
    context.subscriptions.push({dispose: () => clearInterval(timer)});
    ensureEngine(vscode).then(result => {
        log('Project engine setup: ' + JSON.stringify(result));
        if (!result.ready) vscode.window.showInformationMessage('Fast Switch Projects is installed. Reload this window to finish setup.', 'Reload Window')
            .then(action => { if (action === 'Reload Window') vscode.commands.executeCommand('workbench.action.reloadWindow'); });
    }).catch(error => {
        log('Project engine setup failed: ' + error.message);
        vscode.window.showErrorMessage('Fast Switch Projects setup failed: ' + error.message + '. Reload the window to retry.');
    });
}
async function deactivate() {
    if (registered) { try { await broker.request({op:'unregister',key,session}); } catch {} }
}
module.exports = { activate, deactivate };
