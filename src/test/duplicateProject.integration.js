// Run with VS Code's --extensionTestsPath after compiling to out/integration.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vscode = require('vscode');
const { parse } = require('jsonc-parser');
const {
	ManagedWorkspaces,
	resolveWorkspaceFolder,
} = require('../../out/integration/common/managedWorkspaces');
const {
	SlotProjectsDialog,
} = require('../../out/integration/dialogs/SlotProjectsDialog');
const {
	ProjectsDialog,
} = require('../../out/integration/dialogs/ProjectsDialog');
const { ProjectsState } = require('../../out/integration/states/ProjectsState');
const {
	HotkeySlotsState,
} = require('../../out/integration/states/HotkeySlotsState');

exports.run = async function () {
	await vscode.extensions
		.getExtension('ZeyuanYe.fast-switch-projects')
		.activate();
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fsp-actions-'));
	const source = path.join(root, 'source');
	fs.mkdirSync(source);
	fs.writeFileSync(path.join(source, 'file.txt'), 'shared source\n');
	const values = new Map();
	const persisted = new Map();
	const context = {
		subscriptions: [],
		globalState: {
			get: (key, fallback) => (values.has(key) ? values.get(key) : fallback),
			update: (key, value) => {
				const copy = JSON.parse(JSON.stringify(value));
				values.set(key, copy);
				return new Promise((resolve) =>
					setTimeout(() => {
						persisted.set(key, copy);
						resolve();
					}, 1),
				);
			},
		},
	};
	const projects = ProjectsState.create(context),
		slots = HotkeySlotsState.create(context);
	context.subscriptions.push(
		projects.onDidUpdateProject((p) => slots.updateWorkspace(p)),
	);
	const storage = vscode.Uri.file(path.join(root, 'storage'));
	const managed = new ManagedWorkspaces(storage);
	const dialog = new SlotProjectsDialog(storage, projects, slots);
	const original = projects.add(source, 'Source');
	slots.assign(original, 1);
	await projects.persistPendingState();
	const item = { index: 1, slot: slots.get()[1] };
	const savedInput = vscode.window.showInputBox,
		savedPick = vscode.window.showQuickPick;
	const savedError = vscode.window.showErrorMessage,
		savedInfo = vscode.window.showInformationMessage;
	const savedCommand = vscode.commands.executeCommand;
	let input,
		picked,
		failOpen = false;
	const opened = [],
		errors = [];
	vscode.window.showInputBox = async () => input;
	vscode.window.showQuickPick = async (choices) =>
		choices.find((c) => c.path === picked);
	vscode.window.showErrorMessage = async (message) => {
		errors.push(message);
	};
	vscode.window.showInformationMessage = async () => undefined;
	vscode.commands.executeCommand = async (command, uri, newWindow) => {
		if (command !== 'vscode.openFolder')
			throw new Error('Unexpected command: ' + command);
		assert(
			persisted.get('projects').some((p) => p.path === uri.fsPath),
			'Persist projects before opening',
		);
		assert(
			persisted.get('slots').some((s) => s && s.path === uri.fsPath),
			'Persist slots before opening',
		);
		if (failOpen) throw new Error('Simulated open failure');
		opened.push({ uri, newWindow });
	};
	let count = 0;
	async function check(name, fn) {
		await fn();
		count++;
		console.log('PASS ' + name);
	}
	try {
		await check(
			'cancel and blank names do not create a project or workspace',
			async () => {
				for (input of [undefined, '   ']) {
					await dialog.duplicate(item);
					await dialog.rename(item);
				}
				assert.strictEqual(projects.get().length, 1);
				assert.strictEqual(opened.length, 0);
				assert(!fs.existsSync(storage.fsPath));
			},
		);
		await check(
			'duplicate persists a distinct slot and opens the shared folder in a new window',
			async () => {
				input = 'Review';
				await dialog.duplicate(item);
				assert.strictEqual(opened.length, 1);
				assert.strictEqual(opened[0].newWindow, true);
				assert.notStrictEqual(slots.get()[1].path, slots.get()[2].path);
				assert.deepStrictEqual(
					parse(fs.readFileSync(slots.get()[2].path, 'utf8')).folders,
					[{ path: source }],
				);
			},
		);
		const copyPath = slots.get()[2].path;
		await check(
			'rename preserves path and slot, updates the managed title, and leaves source files intact',
			async () => {
				input = 'Analysis';
				await dialog.rename({ index: 2, slot: slots.get()[2] });
				assert.strictEqual(slots.get()[2].path, copyPath);
				assert.strictEqual(slots.get()[2].label, 'Analysis');
				assert(
					String(
						parse(fs.readFileSync(copyPath, 'utf8')).settings['window.title'],
					).includes('Analysis'),
				);
				assert.strictEqual(
					fs.readFileSync(path.join(source, 'file.txt'), 'utf8'),
					'shared source\n',
				);
			},
		);
		await check(
			'original-folder rename only changes the display label',
			async () => {
				input = 'Source renamed';
				await dialog.rename(item);
				assert.strictEqual(slots.get()[1].path, source);
				assert.strictEqual(slots.get()[1].label, input);
				assert(fs.existsSync(source));
			},
		);
		await check(
			'a duplicate can be duplicated without nesting or copying source folders',
			async () => {
				input = 'Debug';
				await dialog.duplicate({ index: 2, slot: slots.get()[2] });
				assert.notStrictEqual(slots.get()[3].path, copyPath);
				assert.deepStrictEqual(
					parse(fs.readFileSync(slots.get()[3].path, 'utf8')).folders,
					[{ path: source }],
				);
			},
		);
		await check(
			'the command-palette picker works and cancellation is harmless',
			async () => {
				const before = projects.get().length;
				picked = undefined;
				await dialog.duplicate();
				assert.strictEqual(projects.get().length, before);
				picked = source;
				input = 'From picker';
				await dialog.duplicate();
				assert.strictEqual(projects.get().length, before + 1);
			},
		);
		await check(
			'an open failure retains the saved duplicate for retry',
			async () => {
				failOpen = true;
				input = 'Retry later';
				const before = projects.get().length;
				await dialog.duplicate(item);
				failOpen = false;
				assert.strictEqual(projects.get().length, before + 1);
				assert(errors.pop().includes('was saved'));
			},
		);
		await check(
			'missing source and malformed workspace failures leave registration unchanged',
			async () => {
				const missing = projects.add(path.join(root, 'missing'), 'Missing');
				slots.assign(missing, 6);
				const before = projects.get().length;
				await dialog.duplicate({ index: 6, slot: slots.get()[6] });
				assert.strictEqual(projects.get().length, before);
				assert(errors.pop().includes('Could not duplicate'));
				const broken = path.join(root, 'broken.code-workspace');
				fs.writeFileSync(broken, '{');
				await assert.rejects(() => managed.duplicate(broken, 'Broken copy'));
				assert.strictEqual(projects.get().length, before);
			},
		);
		await check(
			'workspace copies preserve comments, tasks, settings and named roots while rebasing relative paths',
			async () => {
				const userFile = path.join(root, 'source.code-workspace');
				const text =
					'{// keep me\n"folders":[{"path":"source","name":"Code"}],"settings":{"editor.tabSize":3},"tasks":{"tasks":[]},"launch":{"configurations":[]}}';
				fs.writeFileSync(userFile, text);
				const result = await managed.duplicate(userFile, 'Workspace copy');
				const output = fs.readFileSync(result, 'utf8'),
					config = parse(output);
				assert.deepStrictEqual(config.folders, [
					{ path: source, name: 'Code' },
				]);
				assert.strictEqual(config.settings['editor.tabSize'], 3);
				assert.deepStrictEqual(config.tasks, { tasks: [] });
				assert.deepStrictEqual(config.launch, { configurations: [] });
				assert(output.includes('// keep me'));
				await managed.rename(userFile, 'Untouched');
				assert.strictEqual(fs.readFileSync(userFile, 'utf8'), text);
			},
		);
		await check(
			'managed ownership is exact and supports desktop userdata storage',
			async () => {
				assert(managed.owns(copyPath));
				assert(!managed.owns(path.join(source, 'Project.code-workspace')));
				const desktop = new ManagedWorkspaces(
					storage.with({ scheme: 'vscode-userdata' }),
				);
				assert(desktop.owns(copyPath));
				const created = await desktop.duplicate(source, 'Desktop');
				assert(created.endsWith('/Project.code-workspace'));
				assert(fs.existsSync(created));
			},
		);
		await check(
			'removing and re-adding a duplicate preserves its file and appends a slot',
			async () => {
				const removed = projects.getByPath(copyPath);
				slots.removeAndClose(2);
				projects.remove(removed);
				await projects.persistPendingState();
				assert(fs.existsSync(copyPath));
				assert(!slots.get().some((s) => s && s.path === copyPath));
				const before = slots
					.get()
					.filter(Boolean)
					.map((s) => s.path);
				input = 'Restored analysis';
				await ProjectsDialog.create(projects, slots).save({
					path: copyPath,
					label: 'Analysis',
					type: 'folders',
					remote: false,
				});
				await projects.persistPendingState();
				slots.refresh();
				assert.deepStrictEqual(
					slots
						.get()
						.filter(Boolean)
						.map((s) => s.path),
					[...before, copyPath],
				);
				assert.strictEqual(projects.getByPath(copyPath).label, input);
				assert(fs.existsSync(copyPath));
			},
		);
		await check(
			'remote workspace paths retain their host authority',
			async () => {
				const remote = vscode.Uri.parse(
					'vscode-remote://ssh-remote+test/home/user/configs/source.code-workspace',
				);
				assert.deepStrictEqual(resolveWorkspaceFolder(remote, '../repo one'), {
					uri: vscode.Uri.parse(
						'vscode-remote://ssh-remote+test/home/user/repo%20one',
					).toString(),
				});
				assert.deepStrictEqual(resolveWorkspaceFolder(remote, '/data/repo'), {
					uri: vscode.Uri.parse(
						'vscode-remote://ssh-remote+test/data/repo',
					).toString(),
				});
			},
		);
		console.log(`PASS: ${count} project-action integration checks`);
	} finally {
		vscode.window.showInputBox = savedInput;
		vscode.window.showQuickPick = savedPick;
		vscode.window.showErrorMessage = savedError;
		vscode.window.showInformationMessage = savedInfo;
		vscode.commands.executeCommand = savedCommand;
		for (const disposable of context.subscriptions) disposable.dispose();
		await fs.promises.rm(root, { recursive: true, force: true });
	}
};
