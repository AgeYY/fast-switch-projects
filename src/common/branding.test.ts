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
		assert.strictEqual(manifest.version, '1.5.4');
		assert.strictEqual(manifest.publisher, 'ZeyuanYe');
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

	it('shows only Slots and Graph in the activity view', () => {

		const views = <Array<{ id: string }>>manifest.contributes.views.fastSwitchProjects;

		assert.deepStrictEqual(views.map(({ id }) => id), [
			'fastSwitchProjectsSlots',
			'fastSwitchProjectsGraph',
		]);

	});

	it('keeps the original software notice and public fork credit', () => {

		const license = fs.readFileSync(path.resolve(root, 'LICENSE'), 'utf-8');
		const readme = fs.readFileSync(path.resolve(root, 'README.md'), 'utf-8');

		assert.ok(license.includes('Copyright (c) 2019 - 2023 L13|RARY'));
		assert.ok(license.includes('Modifications Copyright (c) 2026 AgeYY'));
		assert.ok(readme.includes('based on the open-source [Projects extension by L13|RARY]'));
		assert.ok(readme.includes('not affiliated with or endorsed by the original author'));

	});

	it('references existing README screenshots and excludes previews from the package', () => {

		const readme = fs.readFileSync(path.resolve(root, 'README.md'), 'utf-8');
		const vscodeignore = fs.readFileSync(path.resolve(root, '.vscodeignore'), 'utf-8');
		const screenshots = readme.match(/!\[[^\]]*\]\(images\/previews\/[^)]+\)/g) || [];

		assert.ok(screenshots.length >= 2);
		for (const screenshot of screenshots) {
			assert.ok(fs.statSync(path.resolve(root, screenshot.slice(screenshot.indexOf('](') + 2, -1))).isFile());
		}
		assert.ok(vscodeignore.split(/\r?\n/).includes('images/previews/**'));

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
