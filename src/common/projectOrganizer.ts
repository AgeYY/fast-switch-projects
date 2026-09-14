//	Imports ____________________________________________________________________

import type { Slot } from '../@types/hotkeys';
import type { Project } from '../@types/workspaces';

import { getNextSlotIndex } from './slots';

//	Variables __________________________________________________________________

export type ProjectOrganizerStates = {
	hotkeySlots: {
		assign: (project: Project, index: number) => void,
		get: () => Slot[],
	},
};

//	Initialize _________________________________________________________________



//	Exports ____________________________________________________________________

export function organizeNewProject (project: Project, { hotkeySlots }: ProjectOrganizerStates) {

	const existing = hotkeySlots.get().find((slot) => slot && slot.path === project.path);
	if (existing) return { slotIndex: existing.index, added: false };

	const slotIndex = getNextSlotIndex(hotkeySlots.get());
	hotkeySlots.assign(project, slotIndex);
	return { slotIndex, added: true };

}
