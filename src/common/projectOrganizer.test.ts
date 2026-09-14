import * as assert from 'assert';
import type { Slot } from '../@types/hotkeys';
import type { Project } from '../@types/workspaces';
import { organizeNewProject, ProjectOrganizerStates } from './projectOrganizer';
import { removeSlotAndClose } from './slots';

describe('projectOrganizer', () => {

	it('appends after existing slots without overwriting or renumbering them', () => {

		const slots: Slot[] = [];
		slots[2] = { index: 2, label: 'Existing', path: '/projects/Existing' };
		slots[8] = { index: 8, label: 'Last', path: '/projects/Last' };
		const result = organizeNewProject(project('New'), states(slots));
		assert.deepStrictEqual(result, { slotIndex: 9, added: true });
		assert.strictEqual(slots[2].label, 'Existing');
		assert.strictEqual(slots[8].label, 'Last');
		assert.strictEqual(slots[9].path, '/projects/New');

	});
	it('starts at slot one and appends in selection order', () => {

		const slots: Slot[] = [];
		['One', 'Two', 'Three'].forEach((label) => organizeNewProject(project(label), states(slots)));
		assert.deepStrictEqual(slots.slice(1).filter(Boolean).map((slot) => slot.label), ['One', 'Two', 'Three']);

	});
	it('does not duplicate or move a project that is already in a slot', () => {

		const slots: Slot[] = [];
		['One', 'Two'].forEach((label) => organizeNewProject(project(label), states(slots)));
		const before = JSON.stringify(slots);
		assert.deepStrictEqual(organizeNewProject(project('One'), states(slots)), { slotIndex: 1, added: false });
		assert.strictEqual(JSON.stringify(slots), before);

	});
	it('re-adds a removed project at the end with contiguous numbering', () => {

		let slots: Slot[] = [];
		['One', 'Two', 'Three'].forEach((label) => organizeNewProject(project(label), states(slots)));
		slots = removeSlotAndClose(slots, 2).slots;
		assert.deepStrictEqual(slots.slice(1).filter(Boolean).map((slot) => slot.label), ['One', 'Three']);
		organizeNewProject(project('Two'), states(slots));
		assert.deepStrictEqual(slots.slice(1).filter(Boolean).map((slot) => [slot.index, slot.label]), [[1, 'One'], [2, 'Three'], [3, 'Two']]);

	});
	it('supports workspace files, remote URIs, and existing group or tag slots', () => {

		const slots: Slot[] = [undefined, { index: 1, label: 'Group', groupId: 1, paths: ['/projects/One'] }];
		const remote = { ...project('Remote'), path: 'vscode-remote://ssh-remote+server/home/me/project' };
		const file = { ...project('Workspace'), path: '/projects/example.code-workspace' };
		organizeNewProject(remote, states(slots));
		organizeNewProject(file, states(slots));
		assert.strictEqual(slots[1].groupId, 1);
		assert.strictEqual(slots[2].path, remote.path);
		assert.strictEqual(slots[3].path, file.path);

	});

});
function states (slots: Slot[]): ProjectOrganizerStates {

	return { hotkeySlots: {
		get: () => slots,
		assign: (selectedProject, index) => {

			slots[index] = { index, label: selectedProject.label, path: selectedProject.path };

		},
	} };

}
function project (label: string): Project {

	return { label, path: `/projects/${label}`, remote: false, root: '/projects', type: 'folder' };

}
