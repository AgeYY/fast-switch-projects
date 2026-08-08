//	Imports ____________________________________________________________________

import * as assert from 'assert';

import type { Slot } from '../@types/hotkeys';
import type { Project, WorkspaceGroup } from '../@types/workspaces';

import {
	DEFAULT_WORKSPACE_GROUP_LABEL,
	organizeNewProject,
	ProjectOrganizerStates,
} from './projectOrganizer';

//	Variables __________________________________________________________________



//	Initialize _________________________________________________________________

describe('projectOrganizer', () => {

	it('assigns a new project to the first custom group and the slot after the last occupied slot', () => {

		const groups = [group('Alpha', 1), group('Zeta', 2)];
		const slots: Slot[] = [];
		slots[2] = slot('Existing', 2);
		slots[8] = slot('Last', 8);
		const states = createStates(groups, slots);
		const project = workspace('New');

		const result = organizeNewProject(project, states);

		assert.strictEqual(result.group, groups[0]);
		assert.strictEqual(result.slotIndex, 9);
		assert.deepStrictEqual(groups[0].paths, [project.path]);
		assert.strictEqual(groups[1].paths.length, 0);
		assert.strictEqual(slots[9].path, project.path);

	});

	it('creates the Projects group when no custom group exists', () => {

		const groups: WorkspaceGroup[] = [];
		const slots: Slot[] = [];
		const states = createStates(groups, slots);

		const result = organizeNewProject(workspace('First'), states);

		assert.strictEqual(groups.length, 1);
		assert.strictEqual(groups[0].label, DEFAULT_WORKSPACE_GROUP_LABEL);
		assert.strictEqual(result.group, groups[0]);
		assert.strictEqual(result.slotIndex, 1);
		assert.strictEqual(slots[1].label, 'First');

	});

	it('assigns several newly added projects consecutive slots in event order', () => {

		const groups = [group('Main', 1)];
		const slots: Slot[] = [];
		const states = createStates(groups, slots);

		['One', 'Two', 'Three'].forEach((label) => organizeNewProject(workspace(label), states));

		assert.deepStrictEqual(slots.slice(1, 4).map((item) => item.label), ['One', 'Two', 'Three']);
		assert.deepStrictEqual(groups[0].paths, ['/projects/One', '/projects/Two', '/projects/Three']);

	});

});

//	Exports ____________________________________________________________________



//	Functions __________________________________________________________________

function createStates (groups: WorkspaceGroup[], slots: Slot[]): ProjectOrganizerStates {

	return {
		hotkeySlots: {
			assign: (project, index) => slots[index] = {
				index,
				label: project.label,
				path: project.path,
			},
			get: () => slots,
		},
		workspaceGroups: {
			add: (label) => {

				const newGroup = group(label, groups.length + 1);

				groups.push(newGroup);

				return newGroup;

			},
			addWorkspace: (project, selectedGroup) => selectedGroup.paths.push(project.path),
			get: () => groups,
		},
	};

}

function workspace (label: string): Project {

	return {
		label,
		path: `/projects/${label}`,
		remote: false,
		root: '/projects',
		type: 'folder',
	};

}

function group (label: string, id: number): WorkspaceGroup {

	return { collapsed: false, id, label, paths: [] };

}

function slot (label: string, index: number): Slot {

	return { index, label, path: `/projects/${label}` };

}
