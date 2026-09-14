import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import { resolve as resolvePath } from 'path';

export interface Commit {
	readonly id: string;
	readonly parentIds: string[];
	readonly author: string;
	readonly date: string;
	readonly message: string;
	readonly references: Array<{ name: string; kind: string; importance?: 'important' | 'normal' | 'archived' }>;
}

export interface Branch {
	readonly ref: string;
	readonly name: string;
	readonly id: string;
	readonly target: string;
}

export interface BaseBranch extends Branch {
	readonly source: 'selected' | 'remote' | 'name';
}

export interface FileChange {
	readonly status: string;
	readonly before: string;
	readonly after: string;
}

export class GitReader {

	constructor (private readonly executable: string, private readonly cwd: string) {}

	async run (args: string[]): Promise<string> {

		return new Promise((resolve, reject) => {

			execFile(this.executable, ['--no-pager', ...args], {
				cwd: this.cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
				timeout: 20000, windowsHide: true,
				env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' },
			}, (error, stdout, stderr) => {

				if (error) reject(new Error(stderr.trim() || error.message));
				else resolve(stdout);

			});

		});

	}

	async commonDirectory (): Promise<string> {

		return fs.realpath(resolvePath(this.cwd, (await this.run(['rev-parse', '--git-common-dir'])).trim()));

	}

	async referenceState (): Promise<string> {

		const [refs, head] = await Promise.all([
			this.run(['for-each-ref', '--format=%(refname)%00%(objectname)%00%(symref)']),
			this.run(['rev-parse', '--verify', 'HEAD']).catch(() => ''),
		]);
		const branch = await this.run(['symbolic-ref', '-q', 'HEAD']).catch(() => '');
		return `${head}\n${branch}\n${refs}`;

	}

	async branches (): Promise<Branch[]> {

		return parseBranches(await this.run(['for-each-ref', '--format=%(refname)%00%(objectname)%00%(symref)', 'refs/heads', 'refs/remotes']));

	}

	async history (limit: number, allBranches: boolean, baseRef = ''): Promise<{
		commits: Commit[]; head: string; hasMore: boolean; base?: BaseBranch; baseIds?: string[]
	}> {

		// An unborn repository is a normal empty state; other Git errors remain visible.
		let head = '';
		try {
			head = (await this.run(['rev-parse', '--verify', 'HEAD'])).trim();
		} catch {
			await this.run(['rev-parse', '--git-dir']);
		}
		const refs = await this.run(['for-each-ref', '--format=%(objectname)%00%(*objectname)%00%(refname)']);
		if (!head && !refs) return { commits: [], head, hasMore: false };
		const base = selectBaseBranch(await this.branches(), baseRef);
		const revisions = allBranches ? ['--all', ...head ? ['HEAD'] : []] : head ? ['HEAD'] : ['--all'];
		if (!allBranches && head) {
			try {
				revisions.push((await this.run(['rev-parse', '--verify', '@{upstream}'])).trim());
			} catch { /* No upstream. */ }
		}
		if (base && !allBranches) revisions.push(base.ref);
		const baseIds = base ? (await this.run(['rev-list', '--first-parent', `--max-count=${limit + 1}`, base.ref, '--'])).trim().split('\n') : [];
		const raw = await this.run(['log', '--topo-order', '--no-show-signature', '--no-decorate',
			`--max-count=${limit + 1}`, '-z', '--format=%H%x00%P%x00%an%x00%aI%x00%B', ...revisions, '--']);
		const commits = parseLog(raw);
		const byId = new Map(commits.map((commit) => [commit.id, commit]));
		for (const row of refs.split('\n').filter(Boolean)) {
			const [object, peeled, ref] = row.split('\0');
			const commit = byId.get(peeled || object);
			if (!commit || !ref) continue;
			const kind = ref.startsWith('refs/remotes/') ? 'remote' : ref.startsWith('refs/tags/') ? 'tag' : 'local';
			commit.references.push({ name: ref.replace(/^refs\/(heads|remotes|tags)\//, ''), kind });
		}
		return { commits: commits.slice(0, limit), head, hasMore: commits.length > limit, base, baseIds };

	}

	async changes (commit: Commit): Promise<FileChange[]> {

		if (!/^[a-f0-9]{40,64}$/.test(commit.id)) throw new Error('Invalid commit ID.');
		const revisions = commit.parentIds.length ? [commit.parentIds[0], commit.id] : [commit.id];
		const raw = await this.run(['diff-tree', '--root', '--no-commit-id', '--name-status', '-r', '-z', '-M', ...revisions, '--']);
		return parseChanges(raw);

	}

}

export function parseLog (raw: string): Commit[] {

	const fields = raw.split('\0');
	if (fields[fields.length - 1] === '') fields.pop();
	const commits: Commit[] = [];
	for (let i = 0; i < fields.length; i += 5) {
		if (i + 4 >= fields.length || !/^[a-f0-9]{40,64}$/.test(fields[i])) throw new Error('Unexpected Git log output.');
		commits.push({ id: fields[i], parentIds: fields[i + 1].split(' ').filter(Boolean), author: fields[i + 2],
			date: fields[i + 3], message: fields[i + 4].replace(/\s+$/, ''), references: [] });
	}
	return commits;

}

export function parseChanges (raw: string): FileChange[] {

	const fields = raw.split('\0');
	const changes: FileChange[] = [];
	for (let i = 0; i < fields.length - 1;) {
		const status = fields[i++];
		const first = fields[i++];
		const second = /^[RC]/.test(status) ? fields[i++] : first;
		if (first === undefined || second === undefined) throw new Error('Unexpected Git diff output.');
		changes.push({ status: status[0], before: status[0] === 'A' ? '' : first, after: status[0] === 'D' ? '' : second });
	}
	return changes;

}

export function parseBranches (raw: string): Branch[] {

	return raw.split('\n').filter(Boolean).map((row) => {

		const [ref, id, target] = row.split('\0');
		return { ref, id, target, name: ref.replace(/^refs\/(heads|remotes)\//, '') };

	});

}

export function selectBaseBranch (branches: Branch[], selected = ''): BaseBranch | undefined {

	const available = branches.filter((branch) => !branch.target);
	if (selected) {
		const branch = available.find((item) => item.ref === selected);
		return branch ? { ...branch, source: 'selected' } : undefined;
	}
	const remoteHeads = branches.filter((branch) => branch.target && branch.ref.startsWith('refs/remotes/'));
	const remoteHead = remoteHeads.find((branch) => branch.ref === 'refs/remotes/origin/HEAD')
		|| (remoteHeads.length === 1 ? remoteHeads[0] : undefined);
	if (remoteHead) {
		const localRef = remoteHead.target.replace(/^refs\/remotes\/[^/]+\//, 'refs/heads/');
		const branch = available.find((item) => item.ref === localRef) || available.find((item) => item.ref === remoteHead.target);
		if (branch) return { ...branch, source: 'remote' };
	}
	for (const name of ['main', 'master']) {
		const branch = available.find((item) => item.ref === `refs/heads/${name}`)
			|| available.find((item) => item.ref === `refs/remotes/origin/${name}`);
		if (branch) return { ...branch, source: 'name' };
	}
	return undefined;

}
