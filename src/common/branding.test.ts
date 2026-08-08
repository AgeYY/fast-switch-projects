//	Imports ____________________________________________________________________

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

//	Variables __________________________________________________________________

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.resolve(root, 'package.json'), 'utf-8'));
const legacyNamespace = ['l13', 'Projects'].join('');

//	Initialize _________________________________________________________________

describe('public branding', () => {

	it('uses the independent Fast Switch Projects extension identity', () => {

		assert.strictEqual(manifest.name, 'fast-switch-projects');
		assert.strictEqual(manifest.displayName, 'Fast Switch Projects');
		assert.strictEqual(manifest.version, '1.0.0');
		assert.strictEqual(manifest.publisher, 'zeyuan');
		assert.strictEqual(manifest.repository.url, 'https://github.com/AgeYY/fast-switch-projects.git');
		assert.strictEqual(manifest.bugs.url, 'https://github.com/AgeYY/fast-switch-projects/issues');

	});

	it('uses the new namespace in public contributions and extension source', () => {

		const contributions = JSON.stringify(manifest.contributes);
		const source = readTypeScript(path.resolve(root, 'src'));

		assert.ok(!contributions.includes(legacyNamespace));
		assert.ok(!source.includes(legacyNamespace));
		assert.ok(contributions.includes('fastSwitchProjects'));
		assert.ok(source.includes('fastSwitchProjects'));

	});

	it('keeps the original software notice and public fork credit', () => {

		const license = fs.readFileSync(path.resolve(root, 'LICENSE.md'), 'utf-8');
		const readme = fs.readFileSync(path.resolve(root, 'README.md'), 'utf-8');

		assert.ok(license.includes('Copyright (c) 2019 - 2023 L13|RARY'));
		assert.ok(license.includes('Modifications Copyright (c) 2026 AgeYY'));
		assert.ok(readme.includes('based on the open-source [Projects extension by L13|RARY]'));
		assert.ok(readme.includes('not affiliated with or endorsed by the original author'));

	});

	it('uses a text-only Marketplace README', () => {

		const readme = fs.readFileSync(path.resolve(root, 'README.md'), 'utf-8');

		assert.ok(!/!\[[^\]]*\]\([^)]+\)/.test(readme));

	});

});

//	Exports ____________________________________________________________________



//	Functions __________________________________________________________________

function readTypeScript (directory: string): string {

	return fs.readdirSync(directory, { withFileTypes: true }).map((entry) => {

		const filename = path.resolve(directory, entry.name);

		if (entry.isDirectory()) return readTypeScript(filename);
		if (!entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts')) return '';

		return fs.readFileSync(filename, 'utf-8');

	}).join('\n');

}
