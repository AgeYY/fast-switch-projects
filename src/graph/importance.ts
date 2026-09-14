import { Commit } from './git';

export type Importance = 'important' | 'normal' | 'archived';
export type BranchFilter = 'all' | 'active' | 'important';

export function branchKey (ref: { name: string; kind: string }): string | undefined {

	if (ref.kind === 'local') return ref.name;
	if (ref.kind === 'remote' && !ref.name.endsWith('/HEAD')) return ref.name.slice(ref.name.indexOf('/') + 1);
	return undefined;

}

export function applyImportance (commits: Commit[], priorities: Map<string, Importance>, filter: BranchFilter,
	head: string, baseId = '', currentBranch = '', baseBranch = ''): Commit[] {

	const annotated = commits.map((commit) => ({ ...commit, references: commit.references.map((ref) => ({
		...ref, importance: priorities.get(branchKey(ref)) || 'normal',
	})) }));
	if (filter === 'all') return annotated;
	function visible (ref: Commit['references'][number]) {

		const key = branchKey(ref);
		if (!key) return ref.kind === 'tag' && filter === 'active';
		if (key === currentBranch || key === baseBranch) return true;
		const importance = priorities.get(key) || 'normal';
		return filter === 'important' ? importance === 'important' : importance !== 'archived';

	}
	const byId = new Map(annotated.map((commit) => [commit.id, commit]));
	const pending = annotated.filter((commit) => commit.id === head || commit.id === baseId || commit.references.some(visible))
		.map((commit) => commit.id);
	const retained = new Set<string>();
	while (pending.length) {
		const id = pending.pop();
		if (retained.has(id)) continue;
		retained.add(id);
		const commit = byId.get(id);
		if (commit) pending.push(...commit.parentIds);
	}
	return annotated.filter((commit) => retained.has(commit.id)).map((commit) => ({
		...commit, references: commit.references.filter(visible),
	}));

}
