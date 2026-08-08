//	Imports ____________________________________________________________________

import * as assert from 'assert';

import type { Slot } from '../@types/hotkeys';

import {
	dropSlot,
	findAdjacentOccupiedSlot,
	findCurrentWorkspaceSlot,
	findFirstOccupiedSlot,
	findLastOccupiedSlot,
	getNextSlotIndex,
	getOccupiedSlotIndexes,
	insertSlot,
	moveSlot,
	removeSlotAndClose,
} from './slots';

//	Variables __________________________________________________________________

//	Initialize _________________________________________________________________

describe('slots', () => {

	describe(`.${dropSlot.name}()`, () => {

		it('drops a later slot onto an earlier slot and shifts intervening slots down', () => {

			const slots: Slot[] = [];
			for (let i = 1; i <= 5; i++) slots[i] = workspace(String(i), i);

			const result = dropSlot(slots, 5, 2);

			assert.strictEqual(result.changed, true);
			assert.deepStrictEqual(result.slots.slice(1, 6).map((slot) => slot.label), ['1', '5', '2', '3', '4']);

		});

		it('drops an earlier slot onto a later slot', () => {

			const slots: Slot[] = [];
			for (let i = 1; i <= 4; i++) slots[i] = workspace(String(i), i);

			const result = dropSlot(slots, 2, 4);

			assert.deepStrictEqual(result.slots.slice(1, 5).map((slot) => slot.label), ['1', '3', '4', '2']);

		});

		it('drops a slot on empty tree space by moving it to the end', () => {

			const slots: Slot[] = [];
			slots[1] = workspace('Project', 1);
			slots[2] = group('Research', 2);
			slots[3] = tag('Active', 3);

			const result = dropSlot(slots, 1);

			assert.deepStrictEqual(result.slots.slice(1, 4).map((slot) => slot.label), ['Research', 'Active', 'Project']);
			assert.strictEqual(result.slots[1].groupId, 2);
			assert.strictEqual(result.slots[2].tagId, 3);
			assert.strictEqual(result.slots[3].path, '/projects/Project');

		});

		it('ignores invalid and empty drag sources', () => {

			assert.strictEqual(dropSlot([], 0).reason, 'invalid-index');
			assert.strictEqual(dropSlot([], 4).reason, 'empty-source');

		});

	});

	describe(`.${moveSlot.name}()`, () => {

		it('moves an occupied slot up by swapping with its neighbor', () => {

			const slots: Slot[] = [];
			slots[2] = workspace('B', 2);
			slots[3] = workspace('C', 3);

			const result = moveSlot(slots, 3, -1);

			assert.strictEqual(result.changed, true);
			assert.strictEqual(result.slots[2].label, 'C');
			assert.strictEqual(result.slots[2].index, 2);
			assert.strictEqual(result.slots[3].label, 'B');
			assert.strictEqual(result.slots[3].index, 3);

		});

		it('swaps with the previous occupied slot across a hidden gap', () => {

			const slots: Slot[] = [];
			slots[1] = workspace('A', 1);
			slots[3] = workspace('C', 3);

			const result = moveSlot(slots, 3, -1);

			assert.strictEqual(result.slots[1].label, 'C');
			assert.strictEqual(result.slots[1].index, 1);
			assert.strictEqual(result.slots[2], undefined);
			assert.strictEqual(result.slots[3].label, 'A');
			assert.strictEqual(result.slots[3].index, 3);

		});

		it('does not move beyond slot boundaries', () => {

			const slots: Slot[] = [];
			slots[1] = workspace('A', 1);

			const result = moveSlot(slots, 1, -1);

			assert.strictEqual(result.changed, false);
			assert.strictEqual(result.reason, 'boundary');

		});

	});

	describe(`.${insertSlot.name}()`, () => {

		it('inserts an unassigned workspace and shifts later slots down', () => {

			const slots: Slot[] = [];
			slots[2] = workspace('B', 2);
			slots[3] = workspace('C', 3);

			const result = insertSlot(slots, workspace('X', 0), 2);

			assert.strictEqual(result.slots[1], undefined);
			assert.deepStrictEqual(result.slots.slice(2, 5).map((slot) => slot.label), ['X', 'B', 'C']);
			assert.deepStrictEqual(result.slots.slice(2, 5).map((slot) => slot.index), [2, 3, 4]);

		});

		it('moves an existing slot to an earlier position without leaving a gap', () => {

			const slots: Slot[] = [];
			slots[1] = workspace('A', 1);
			slots[2] = workspace('B', 2);
			slots[3] = workspace('C', 3);
			slots[4] = workspace('D', 4);

			const result = insertSlot(slots, slots[3], 2);

			assert.deepStrictEqual(result.slots.slice(1, 5).map((slot) => slot.label), ['A', 'C', 'B', 'D']);

		});

		it('moves an existing slot to a later position', () => {

			const slots: Slot[] = [];
			slots[1] = workspace('A', 1);
			slots[2] = workspace('B', 2);
			slots[3] = workspace('C', 3);
			slots[4] = workspace('D', 4);

			const result = insertSlot(slots, slots[2], 4);

			assert.deepStrictEqual(result.slots.slice(1, 5).map((slot) => slot.label), ['A', 'C', 'D', 'B']);

		});

		it('supports workspace, group, and tag slot identities', () => {

			const slots: Slot[] = [];
			slots[1] = workspace('A', 1);
			slots[2] = group('Research', 2);
			slots[3] = tag('Active', 3);

			const movedGroup = insertSlot(slots, slots[2], 3);
			const movedTag = insertSlot(movedGroup.slots, movedGroup.slots[2], 1);

			assert.deepStrictEqual(movedTag.slots.slice(1, 4).map((slot) => slot.label), ['Active', 'A', 'Research']);
			assert.strictEqual(movedTag.slots[1].tagId, 3);
			assert.strictEqual(movedTag.slots[3].groupId, 2);

		});

		it('inserts beyond slot 9 without discarding an occupied project', () => {

			const slots: Slot[] = [];
			for (let i = 1; i <= 9; i++) slots[i] = workspace(String(i), i);

			const result = insertSlot(slots, workspace('X', 0), 2);

			assert.strictEqual(result.changed, true);
			assert.strictEqual(result.slots[2].label, 'X');
			assert.strictEqual(result.slots[9].label, '8');
			assert.strictEqual(result.slots[10].label, '9');
			assert.strictEqual(result.slots[10].index, 10);

		});

		it('preserves sparse saved slot numbers when inserting at the end', () => {

			const slots: Slot[] = [];
			slots[2] = workspace('B', 2);
			slots[12] = workspace('L', 12);

			const result = insertSlot(slots, workspace('M', 0), 13);

			assert.strictEqual(result.slots[2].label, 'B');
			assert.strictEqual(result.slots[12].label, 'L');
			assert.strictEqual(result.slots[13].label, 'M');

		});

	});

	describe(`.${removeSlotAndClose.name}()`, () => {

		it('removes a slot and shifts all following slots up', () => {

			const slots: Slot[] = [];
			slots[1] = workspace('A', 1);
			slots[2] = group('Research', 2);
			slots[3] = tag('Active', 3);

			const result = removeSlotAndClose(slots, 2);

			assert.strictEqual(result.changed, true);
			assert.strictEqual(result.slots[2].label, 'Active');
			assert.strictEqual(result.slots[2].index, 2);
			assert.strictEqual(result.slots[3], undefined);

		});

		it('does not modify an empty slot', () => {

			const result = removeSlotAndClose([], 4);

			assert.strictEqual(result.changed, false);
			assert.strictEqual(result.reason, 'empty-source');

		});

	});

	describe('navigation', () => {

		const slots: Slot[] = [];
		slots[2] = workspace('B', 2);
		slots[5] = workspace('E', 5);
		slots[12] = workspace('L', 12);

		it('finds the first and last occupied slots', () => {

			assert.strictEqual(findFirstOccupiedSlot(slots), 2);
			assert.strictEqual(findLastOccupiedSlot(slots), 12);

		});

		it('moves forward and skips empty slots', () => {

			assert.strictEqual(findAdjacentOccupiedSlot(slots, 2, 1), 5);

		});

		it('moves backward and skips empty slots', () => {

			assert.strictEqual(findAdjacentOccupiedSlot(slots, 12, -1), 5);

		});

		it('wraps in both directions', () => {

			assert.strictEqual(findAdjacentOccupiedSlot(slots, 12, 1), 2);
			assert.strictEqual(findAdjacentOccupiedSlot(slots, 2, -1), 12);

		});

		it('uses the nearest edge when the current slot is unknown', () => {

			assert.strictEqual(findAdjacentOccupiedSlot(slots, 0, 1), 2);
			assert.strictEqual(findAdjacentOccupiedSlot(slots, 0, -1), 12);

		});

		it('lists only occupied indexes and offers the next slot after the last one', () => {

			assert.deepStrictEqual(getOccupiedSlotIndexes(slots), [2, 5, 12]);
			assert.strictEqual(getNextSlotIndex(slots), 13);
			assert.strictEqual(getNextSlotIndex([]), 1);

		});

		it('returns zero when no slots are occupied', () => {

			assert.strictEqual(findFirstOccupiedSlot([]), 0);
			assert.strictEqual(findLastOccupiedSlot([]), 0);
			assert.strictEqual(findAdjacentOccupiedSlot([], 4, 1), 0);

		});

	});

	describe(`.${findCurrentWorkspaceSlot.name}()`, () => {

		it('identifies a directly assigned current workspace', () => {

			const slots: Slot[] = [];
			slots[4] = workspace('Current', 4);

			assert.strictEqual(findCurrentWorkspaceSlot(slots, '/projects/Current'), 4);

		});

		it('identifies a current workspace inside a group or tag slot', () => {

			const slots: Slot[] = [];
			slots[3] = group('Research', 3);
			slots[7] = tag('Active', 7);

			assert.strictEqual(findCurrentWorkspaceSlot(slots, '/groups/Research'), 3);
			assert.strictEqual(findCurrentWorkspaceSlot(slots, '/tags/Active'), 7);

		});

		it('prefers the last opened matching group when more than one slot contains the workspace', () => {

			const slots: Slot[] = [];
			slots[2] = { ...group('Research', 2), paths: ['/projects/shared'] };
			slots[6] = { ...tag('Active', 6), paths: ['/projects/shared'] };

			assert.strictEqual(findCurrentWorkspaceSlot(slots, '/projects/shared', 6), 6);

		});

		it('does not mark a slot when the current workspace is unassigned', () => {

			const slots: Slot[] = [];
			slots[1] = workspace('Other', 1);

			assert.strictEqual(findCurrentWorkspaceSlot(slots, '/projects/Current', 1), 0);

		});

	});

});

//	Exports ____________________________________________________________________



//	Functions __________________________________________________________________

function workspace (label: string, index: number): Slot {

	return { label, index, path: `/projects/${label}` };

}

function group (label: string, index: number): Slot {

	return { label, index, groupId: index, paths: [`/groups/${label}`] };

}

function tag (label: string, index: number): Slot {

	return { label, index, tagId: index, paths: [`/tags/${label}`] };

}
