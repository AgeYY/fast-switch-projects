import * as assert from 'assert';
import { Commit } from './git';
import { simplifyHistory } from './simplify';
import { layoutGraph } from './layout';

function node (id: string, parentIds: string[], branch = ''): Commit {

	return { id, parentIds, author: '', date: '', message: id,
		references: branch ? [{ name: branch, kind: 'local' }] : [] };

}

describe('Simple graph topology', () => {

	it('collapses linear commits while preserving original parents for commit details', () => {

		const commits = [node('tip', ['b'], 'main'), node('b', ['c']), node('c', ['root']), node('root', [])];
		const result = simplifyHistory(commits, 'tip');
		assert.deepStrictEqual(result.commits.map((commit) => [commit.id, commit.parentIds]), [['tip', ['root']], ['root', []]]);
		assert.strictEqual(result.hiddenCount, 2);
		assert.deepStrictEqual(commits[0].parentIds, ['b']);

	});
	it('preserves both branch tips and the branch point', () => {

		const commits = [node('left', ['a'], 'left'), node('right', ['b'], 'right'), node('a', ['fork']),
			node('b', ['fork']), node('fork', ['c']), node('c', ['root']), node('root', [])];
		const result = simplifyHistory(commits, 'left');
		assert.deepStrictEqual(result.commits.map((commit) => commit.id), ['left', 'right', 'fork', 'root']);
		assert.strictEqual(result.labels.get('fork'), 'Branch point');
		assert.deepStrictEqual(result.commits[0].parentIds, ['fork']);
		assert.deepStrictEqual(result.commits[1].parentIds, ['fork']);

	});
	it('preserves merge paths even when both contracted edges reach the same branch point', () => {

		const commits = [node('merge', ['a', 'b']), node('a', ['fork']), node('b', ['fork']), node('fork', ['root']), node('root', [])];
		const result = simplifyHistory(commits, 'merge');
		assert.strictEqual(result.labels.get('merge'), 'Merge');
		assert.deepStrictEqual(result.commits[0].parentIds, ['fork', 'fork']);
		const rows = layoutGraph(result.commits, 'merge', ['merge', 'a', 'fork', 'root']);
		assert.strictEqual(rows[0].outputSwimlanes.length, 2);
		assert.strictEqual(rows[0].outputSwimlanes[0].color, 'fastSwitchProjects.baseBranch');
		assert.notStrictEqual(rows[0].outputSwimlanes[1].color, 'fastSwitchProjects.baseBranch');
		assert.strictEqual(rows[rows.length - 1].outputSwimlanes.length, 0);

	});
	it('keeps HEAD and reference endpoints inside a linear chain', () => {

		const commits = [node('tip', ['head'], 'main'), node('head', ['tag']), node('tag', ['hidden'], 'release'),
			node('hidden', ['root']), node('root', [])];
		assert.deepStrictEqual(simplifyHistory(commits, 'head').commits.map((commit) => commit.id), ['tip', 'head', 'tag', 'root']);

	});
	it('preserves pagination boundaries without calling them roots', () => {

		const result = simplifyHistory([node('tip', ['middle'], 'main'), node('middle', ['boundary']), node('boundary', ['unloaded'])], 'tip');
		assert.strictEqual(result.labels.get('boundary'), 'Earlier history');
		assert.deepStrictEqual(result.commits[1].parentIds, ['unloaded']);

	});
	it('preserves disconnected roots and handles an empty history', () => {

		assert.strictEqual(simplifyHistory([], '').commits.length, 0);
		const result = simplifyHistory([node('left', [], 'left'), node('right', [], 'right')], 'left');
		assert.strictEqual(result.commits.length, 2);
		assert.strictEqual(result.hiddenCount, 0);

	});

});
