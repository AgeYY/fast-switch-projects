import * as assert from 'assert';
import { parse } from 'jsonc-parser';

import { duplicateWorkspaceConfig, setWorkspaceTitle, validateProjectName } from './workspaceConfig';

describe('duplicated workspace configuration', () => {

	it('rebases folders and preserves settings, named roots, tasks, launch configurations, and comments', () => {

		const source = `{
			// Keep the shared source folder
			"folders": [{ "path": "../repo", "name": "Source" }, { "path": "../data" }],
			"settings": { "editor.tabSize": 3 },
			"tasks": { "version": "2.0.0", "tasks": [] },
			"launch": { "configurations": [] },
		}`;
		const result = duplicateWorkspaceConfig(source, (folder) => ({ path: `/projects/${folder.slice(3)}` }), 'Review');
		const config = parse(result);
		assert.deepStrictEqual(config.folders, [{ path: '/projects/repo', name: 'Source' }, { path: '/projects/data' }]);
		assert.strictEqual(config.settings['editor.tabSize'], 3);
		assert.ok(String(config.settings['window.title']).includes('Review'));
		assert.deepStrictEqual(config.tasks, parse(source).tasks);
		assert.deepStrictEqual(config.launch, parse(source).launch);
		assert.ok(result.includes('// Keep the shared source folder'));
		assert.strictEqual(parse(source).folders[0].path, '../repo');

	});

	it('keeps remote authorities and existing URI roots while converting remote path roots', () => {

		const remote = 'vscode-remote://ssh-remote+research/home/user/repo%20one';
		const source = JSON.stringify({
			folders: [{ path: '../repo one', name: 'Code' }, { uri: 'vscode-remote://ssh-remote+other/data' }],
			remoteAuthority: 'ssh-remote+research',
		});
		const config = parse(duplicateWorkspaceConfig(source, () => ({ uri: remote }), 'Remote copy'));
		assert.deepStrictEqual(config.folders, [{ uri: remote, name: 'Code' }, { uri: 'vscode-remote://ssh-remote+other/data' }]);
		assert.strictEqual(config.remoteAuthority, 'ssh-remote+research');

	});

	it('can duplicate a duplicate and rename its title without changing roots or other settings', () => {

		const first = duplicateWorkspaceConfig('{"folders":[{"path":"/repo"}]}', (folder) => ({ path: folder }), 'First');
		const second = duplicateWorkspaceConfig(first, (folder) => ({ path: folder }), 'Second');
		const renamed = setWorkspaceTitle(second, 'Review — α');
		assert.deepStrictEqual(parse(renamed).folders, [{ path: '/repo' }]);
		assert.ok(String(parse(first).settings['window.title']).includes('First'));
		assert.ok(String(parse(second).settings['window.title']).includes('Second'));
		assert.ok(String(parse(renamed).settings['window.title']).includes('Review — α'));

	});

	it('supports saved workspaces with no folders', () => {

		assert.deepStrictEqual(parse(duplicateWorkspaceConfig('{"folders":[]}', () => {

			throw new Error('Unexpected root');

		}, 'Empty')).folders, []);

	});

	it('rejects damaged documents instead of silently dropping their configuration', () => {

		for (const source of ['{', '{}', 'null', '{"folders":{}}', '{"folders":[], "settings":null}', '{"folders":[], "settings":[]}']) {
			assert.throws(() => duplicateWorkspaceConfig(source, (folder) => ({ path: folder }), 'Copy'));
		}
		for (const folder of [null, 1, [], {}, { path: 3 }, { path: 'repo', uri: 'file:///repo' }]) {
			assert.throws(() => duplicateWorkspaceConfig(JSON.stringify({ folders: [folder] }), (value) => ({ path: value }), 'Copy'));
		}

	});

	it('rejects blank names and accepts Unicode names', () => {

		assert.ok(validateProjectName(''));
		assert.ok(validateProjectName('  \t'));
		assert.strictEqual(validateProjectName('Review — α'), null);

	});

});
