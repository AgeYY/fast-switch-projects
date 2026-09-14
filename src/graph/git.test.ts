import * as assert from 'assert';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { Commit, GitReader, parseChanges, parseLog } from './git';
import { layoutGraph } from './layout';
import { ImportanceStore } from './ImportanceStore';

let directory: string;
function git (...args: string[]): string {

	return execFileSync('git', args, { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

}
function commit (name: string, file = 'file.txt', content = name): string {

	fs.writeFileSync(path.join(directory, file), content);
	git('add', '--', file);
	git('commit', '-m', name);
	return git('rev-parse', 'HEAD');

}
describe('Git graph with real repositories', () => {

	beforeEach(() => {

		directory = fs.mkdtempSync(path.join(tmpdir(), 'fsp-graph-test-'));
		git('init', '-b', 'main');
		git('config', 'user.name', 'Graph Test');
		git('config', 'user.email', 'graph@example.test');
		git('config', 'commit.gpgsign', 'false');
		git('config', 'core.autocrlf', 'false');

	});
	afterEach(() => fs.rmdirSync(directory, { recursive: true }));
	it('handles an unborn repository and root commit diff', async () => {

		const reader = new GitReader('git', directory);
		assert.deepStrictEqual(await reader.history(10, false), { commits: [], head: '', hasMore: false });
		commit('root <script>alert(1)</script>', 'space\ttab\nline.txt');
		const history = await reader.history(10, false);
		assert.strictEqual(history.commits[0].message, 'root <script>alert(1)</script>');
		assert.deepStrictEqual(await reader.changes(history.commits[0]), [
			{ status: 'A', before: '', after: 'space\ttab\nline.txt' },
		]);

	});
	it('keeps topological parent edges and refs for merges and annotated tags', async () => {

		const root = commit('root');
		git('checkout', '-b', 'feature');
		const feature = commit('feature', 'feature.txt');
		git('checkout', 'main');
		const main = commit('main', 'main.txt');
		git('merge', '--no-ff', 'feature', '-m', 'merge');
		git('tag', '-a', 'v1', '-m', 'release');
		const reader = new GitReader('git', directory);
		const history = await reader.history(20, true);
		assert.deepStrictEqual(history.commits[0].parentIds, [main, feature]);
		assert.ok(history.commits[0].references.some((ref) => ref.name === 'v1' && ref.kind === 'tag'));
		assert.strictEqual(history.commits[history.commits.length - 1].id, root);
		const rows = layoutGraph(history.commits, history.head);
		assert.strictEqual(rows[0].kind, 'HEAD');
		assert.strictEqual(rows[0].outputSwimlanes.length, 2);
		rows.forEach((row, index) => {

			if (index) assert.deepStrictEqual(row.inputSwimlanes, rows[index - 1].outputSwimlanes);
			row.historyItem.parentIds.forEach((id) => assert.ok(row.outputSwimlanes.some((lane) => lane.id === id)));

		});
		assert.strictEqual(rows[rows.length - 1].outputSwimlanes.length, 0);
		const files = await reader.changes(history.commits[0]);
		assert.deepStrictEqual(files.map((file) => file.after), ['feature.txt']);

	});
	it('paginates without false end-of-history and includes detached HEAD with all branches', async () => {

		commit('root');
		commit('second');
		git('checkout', '--detach');
		const detached = commit('detached');
		const reader = new GitReader('git', directory);
		const page = await reader.history(2, true);
		assert.strictEqual(page.commits[0].id, detached);
		assert.strictEqual(page.commits.length, 2);
		assert.strictEqual(page.hasMore, true);
		assert.strictEqual((await reader.history(3, true)).hasMore, false);

	});
	it('loads both sides of a diverged upstream in current mode', async () => {

		commit('root');
		git('remote', 'add', 'origin', directory);
		git('checkout', '-b', 'remote-side');
		const remote = commit('remote', 'remote.txt');
		git('update-ref', 'refs/remotes/origin/main', remote);
		git('checkout', 'main');
		git('branch', '--set-upstream-to=origin/main');
		const local = commit('local', 'local.txt');
		const history = await new GitReader('git', directory).history(10, false);
		assert.ok(history.commits.some((item) => item.id === remote));
		assert.ok(history.commits.some((item) => item.id === local));

	});
	it('reports rename and deletion paths without splitting whitespace', async () => {

		commit('root', 'before file.txt', 'same content');
		git('mv', 'before file.txt', 'after\tfile.txt');
		git('commit', '-m', 'rename');
		const reader = new GitReader('git', directory);
		let history = await reader.history(10, false);
		assert.deepStrictEqual(await reader.changes(history.commits[0]), [
			{ status: 'R', before: 'before file.txt', after: 'after\tfile.txt' },
		]);
		git('rm', 'after\tfile.txt');
		git('commit', '-m', 'delete');
		history = await reader.history(10, false);
		assert.deepStrictEqual(await reader.changes(history.commits[0]), [
			{ status: 'D', before: 'after\tfile.txt', after: '' },
		]);

	});
	it('supports linked worktree Git directories', async () => {

		commit('root');
		const worktree = path.join(directory, 'linked');
		git('worktree', 'add', '--detach', worktree);
		const history = await new GitReader('git', worktree).history(10, false);
		assert.strictEqual(history.commits.length, 1);

	});
	it('detects a renamed remote default instead of assuming main', async () => {

		const root = commit('root');
		git('branch', 'trunk');
		git('update-ref', 'refs/remotes/origin/trunk', root);
		git('symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/trunk');
		const history = await new GitReader('git', directory).history(10, true);
		assert.strictEqual(history.base?.ref, 'refs/heads/trunk');
		assert.strictEqual(history.base?.source, 'remote');
		assert.deepStrictEqual(history.baseIds, [root]);

	});
	it('supports a manual base and does not silently replace a deleted selection', async () => {

		commit('root');
		git('checkout', '-b', 'release');
		const release = commit('release');
		const reader = new GitReader('git', directory);
		assert.strictEqual((await reader.history(10, true)).base?.name, 'main');
		const manual = await reader.history(10, true, 'refs/heads/release');
		assert.strictEqual(manual.base?.source, 'selected');
		assert.strictEqual(manual.base?.id, release);
		assert.strictEqual((await reader.history(10, true, 'refs/heads/missing')).base, undefined);

	});
	it('highlights only first-parent base history across merges and refreshes moved tips', async () => {

		const root = commit('root');
		git('checkout', '-b', 'feature');
		const feature = commit('feature', 'feature.txt');
		git('checkout', 'main');
		const main = commit('main', 'main.txt');
		git('merge', '--no-ff', 'feature', '-m', 'merge');
		const merge = git('rev-parse', 'HEAD');
		const reader = new GitReader('git', directory);
		const history = await reader.history(10, true);
		assert.deepStrictEqual(history.baseIds, [merge, main, root]);
		const rows = layoutGraph(history.commits, history.head, history.baseIds);
		assert.strictEqual(rows.find((row) => row.historyItem.id === feature)?.base, false);
		assert.strictEqual(rows[0].outputSwimlanes[0].color, 'fastSwitchProjects.baseBranch');
		assert.notStrictEqual(rows[0].outputSwimlanes[1].color, 'fastSwitchProjects.baseBranch');
		const next = commit('next');
		assert.strictEqual((await reader.history(10, true)).base?.id, next);

	});
	it('handles remote-only defaults, custom names and detached HEAD', async () => {

		const root = commit('root');
		git('branch', '-m', 'development');
		git('update-ref', 'refs/remotes/upstream/trunk', root);
		git('symbolic-ref', 'refs/remotes/upstream/HEAD', 'refs/remotes/upstream/trunk');
		git('checkout', '--detach');
		const history = await new GitReader('git', directory).history(10, true);
		assert.strictEqual(history.base?.ref, 'refs/remotes/upstream/trunk');
		assert.strictEqual(layoutGraph(history.commits, history.head, history.baseIds)[0].kind, 'HEAD');

	});
	it('leaves unknown defaults unmarked and includes a diverged base in Current mode', async () => {

		commit('root');
		git('branch', '-m', 'custom');
		const reader = new GitReader('git', directory);
		assert.strictEqual((await reader.history(10, true)).base, undefined);
		git('checkout', '-b', 'main');
		const main = commit('main', 'main.txt');
		git('checkout', 'custom');
		const feature = commit('custom', 'custom.txt');
		const history = await reader.history(10, false);
		assert.ok(history.commits.some((item) => item.id === main));
		assert.ok(history.commits.some((item) => item.id === feature));

	});
	it('detects new branches without new commits, including packed refs and deletion', async () => {

		const root = commit('root');
		const reader = new GitReader('git', directory);
		const before = await reader.referenceState();
		git('branch', 'feature/new-branch-with-a-long-name');
		const after = await reader.referenceState();
		assert.notStrictEqual(after, before);
		const history = await reader.history(10, true);
		assert.strictEqual(history.commits.length, 1);
		assert.strictEqual(history.commits[0].id, root);
		assert.ok(history.commits[0].references.some((ref) => ref.name === 'feature/new-branch-with-a-long-name'));
		git('pack-refs', '--all');
		assert.strictEqual(await reader.referenceState(), after);
		git('branch', '-d', 'feature/new-branch-with-a-long-name');
		assert.strictEqual(await reader.referenceState(), before);

	});
	it('detects branch switches at the same commit and changes from a sibling worktree', async () => {

		commit('root');
		const reader = new GitReader('git', directory);
		const linked = path.join(directory, 'linked');
		git('worktree', 'add', '--detach', linked);
		const linkedReader = new GitReader('git', linked);
		const before = await linkedReader.referenceState();
		git('branch', 'feature/sibling');
		assert.notStrictEqual(await linkedReader.referenceState(), before);
		assert.ok((await linkedReader.history(10, true)).commits[0].references.some((ref) => ref.name === 'feature/sibling'));
		const beforeSwitch = await reader.referenceState();
		git('checkout', 'feature/sibling');
		assert.notStrictEqual(await reader.referenceState(), beforeSwitch);

	});
	it('shares importance between worktrees without changing code, commits, or refs', async () => {

		const head = commit('root');
		const linked = path.join(directory, 'linked');
		git('worktree', 'add', '--detach', linked);
		const reader = new GitReader('git', directory);
		const sibling = new GitReader('git', linked);
		assert.strictEqual(await reader.commonDirectory(), await sibling.commonDirectory());
		const status = git('status', '--porcelain');
		const refs = await reader.referenceState();
		const first = new ImportanceStore(await reader.commonDirectory());
		const second = new ImportanceStore(await sibling.commonDirectory());
		await first.set('feature/shared', 'important');
		assert.strictEqual((await second.read()).get('feature/shared'), 'important');
		await second.set('feature/shared', 'archived');
		assert.strictEqual((await first.read()).get('feature/shared'), 'archived');
		await first.set('feature/shared', 'normal');
		assert.strictEqual((await second.read()).size, 0);
		assert.strictEqual(git('rev-parse', 'HEAD'), head);
		assert.strictEqual(git('status', '--porcelain'), status);
		assert.strictEqual(await reader.referenceState(), refs);

	});
	it('preserves simultaneous importance edits to different branches', async () => {

		commit('root');
		const common = await new GitReader('git', directory).commonDirectory();
		const first = new ImportanceStore(common);
		const second = new ImportanceStore(common);
		await Promise.all([first.set('feature/one', 'important'), second.set('feature/two', 'archived')]);
		assert.deepStrictEqual(Array.from(await first.read()).sort(), [['feature/one', 'important'], ['feature/two', 'archived']]);

	});
	it('does not swallow invalid repositories and malformed log records', async () => {

		fs.rmdirSync(path.join(directory, '.git'), { recursive: true });
		await assert.rejects(new GitReader('git', directory).history(10, false));
		assert.throws(() => parseLog('invalid\0record'));
		assert.deepStrictEqual(parseChanges(''), []);

	});

});

describe('Graph layout disconnected histories', () => {

	it('preserves a different branch lane across a root commit', () => {

		const commits: Commit[] = [
			{ id: 'a', parentIds: ['c'], author: '', date: '', message: '', references: [] },
			{ id: 'b', parentIds: [], author: '', date: '', message: '', references: [] },
			{ id: 'c', parentIds: [], author: '', date: '', message: '', references: [] },
		];
		const rows = layoutGraph(commits, 'a');
		assert.deepStrictEqual(rows[1].outputSwimlanes.map((lane) => lane.id), ['c']);
		assert.strictEqual(rows[2].outputSwimlanes.length, 0);

	});

});
