import type { Slot } from '../@types/hotkeys';

export function collectListedProjects (slots: Slot[], tagPaths: (id: number) => string[]) {

	const paths = new Set<string>();
	for (const slot of slots) {
		if (!slot) continue;
		const listed = slot.tagId !== undefined ? tagPaths(slot.tagId) : slot.paths || [slot.path];
		for (const path of listed || []) if (path) paths.add(path);
	}
	return [...paths];

}
