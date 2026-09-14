import * as assert from 'assert';
import { Commit } from './git';
import { applyImportance, branchKey, Importance } from './importance';
import { simplifyHistory } from './simplify';

function node (id: string, parentIds: string[], names: string[]): Commit {

	return { id, parentIds, author: '', date: '', message: id,
		references: names.map((name) => ({ name, kind: name.startsWith('origin/') ? 'remote' : 'local' })) };

}

describe('Branch importance', () => {

	it('maps local and remote branches together without treating tags or remote HEAD as branches', () => {

		assert.strictEqual(branchKey({ name: 'feature/topic', kind: 'local' }), 'feature/topic');
		assert.strictEqual(branchKey({ name: 'origin/feature/topic', kind: 'remote' }), 'feature/topic');
		assert.strictEqual(branchKey({ name: 'origin/HEAD', kind: 'remote' }), undefined);
		assert.strictEqual(branchKey({ name: 'release', kind: 'tag' }), undefined);

	});
	it('annotates all labels without mutating commits or hiding archived branches in All', () => {

		const commits = [node('a', [], ['feature', 'origin/feature'])];
		const priorities = new Map<string, Importance>([['feature', 'archived']]);
		const result = applyImportance(commits, priorities, 'all', 'a');
		assert.deepStrictEqual(result[0].references.map((ref) => ref.importance), ['archived', 'archived']);
		assert.strictEqual(commits[0].references[0].importance, undefined);

	});
	it('keeps important tips, HEAD, base, and their merge ancestry while dropping unrelated tips', () => {

		const commits = [node('head', ['root'], ['current']), node('base', ['root'], ['main']),
			node('star', ['merge'], ['important', 'origin/important']), node('other', ['root'], ['other']),
			node('merge', ['left', 'right'], []), node('left', ['root'], ['old']), node('right', ['root'], []), node('root', [], [])];
		const priorities = new Map<string, Importance>([['important', 'important'], ['current', 'archived'], ['main', 'archived']]);
		const result = applyImportance(commits, priorities, 'important', 'head', 'base', 'current', 'main');
		assert.ok(!result.some((commit) => commit.id === 'other'));
		assert.deepStrictEqual(result.find((commit) => commit.id === 'merge').parentIds, ['left', 'right']);
		assert.strictEqual(result.find((commit) => commit.id === 'left').references.length, 0);
		assert.strictEqual(result.find((commit) => commit.id === 'head').references[0].name, 'current');
		assert.strictEqual(result.find((commit) => commit.id === 'base').references[0].name, 'main');
		assert.ok(simplifyHistory(result, 'head').commits.some((commit) => commit.id === 'merge'));

	});
	it('hides archived branch labels and unique history, but preserves an archived current branch', () => {

		const commits = [node('head', ['root'], ['current']), node('old', ['root'], ['old']), node('root', [], ['main'])];
		const priorities = new Map<string, Importance>([['old', 'archived'], ['current', 'archived']]);
		const result = applyImportance(commits, priorities, 'active', 'head', 'root', 'current', 'main');
		assert.deepStrictEqual(result.map((commit) => commit.id), ['head', 'root']);

	});

});
