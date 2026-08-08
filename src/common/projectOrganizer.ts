//	Imports ____________________________________________________________________

import type { Slot } from '../@types/hotkeys';
import type { Project, WorkspaceGroup } from '../@types/workspaces';

import { getNextSlotIndex } from './slots';

//	Variables __________________________________________________________________

export const DEFAULT_WORKSPACE_GROUP_LABEL = 'Projects';

export type ProjectOrganizerStates = {
	hotkeySlots: {
		assign: (project: Project, index: number) => void,
		get: () => Slot[],
	},
	workspaceGroups: {
		add: (label: string) => WorkspaceGroup,
		addWorkspace: (project: Project, group: WorkspaceGroup) => void,
		get: () => WorkspaceGroup[],
	},
};

//	Initialize _________________________________________________________________



//	Exports ____________________________________________________________________

export function organizeNewProject (project: Project, { hotkeySlots, workspaceGroups }: ProjectOrganizerStates) {

	const group = workspaceGroups.get()[0] || workspaceGroups.add(DEFAULT_WORKSPACE_GROUP_LABEL);
	const slotIndex = getNextSlotIndex(hotkeySlots.get());

	workspaceGroups.addWorkspace(project, group);
	hotkeySlots.assign(project, slotIndex);

	return { group, slotIndex };

}

//	Functions __________________________________________________________________
