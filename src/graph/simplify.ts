import { Commit } from './git';

// Contract only linear chains. Junctions and loaded-history boundaries remain explicit.
export function simplifyHistory (commits: Commit[], head: string) {

	const byId = new Map(commits.map((commit) => [commit.id, commit]));
	const children = new Map<string, Set<string>>();
	for (const commit of commits) {
		for (const parent of commit.parentIds) {
			if (!children.has(parent)) children.set(parent, new Set());
			children.get(parent).add(commit.id);
		}
	}
	const labels = new Map<string, string>();
	const retained = new Set<string>();
	for (const commit of commits) {
		const childCount = children.get(commit.id)?.size || 0;
		const boundary = commit.parentIds.some((id) => !byId.has(id));
		if (commit.id === head || commit.references.length || commit.parentIds.length !== 1 || childCount !== 1 || boundary) {
			retained.add(commit.id);
			let label = 'Branch tip';
			if (commit.parentIds.length > 1) label = 'Merge';
			else if (childCount > 1) label = 'Branch point';
			else if (boundary) label = 'Earlier history';
			else if (!commit.parentIds.length) label = 'Start';
			labels.set(commit.id, label);
		}
	}
	const resolved = new Map<string, string>();
	function endpoint (id: string): string {

		const skipped: string[] = [];
		while (byId.has(id) && !retained.has(id)) {
			if (resolved.has(id)) {
				id = resolved.get(id); break;
			}
			skipped.push(id);
			id = byId.get(id).parentIds[0];
		}
		for (const hidden of skipped) resolved.set(hidden, id);
		return id;

	}
	const visible = commits.filter((commit) => retained.has(commit.id)).map((commit) => ({
		...commit, parentIds: commit.parentIds.map(endpoint),
	}));
	return { commits: visible, labels, hiddenCount: commits.length - visible.length };

}
