//	Imports ____________________________________________________________________

import type { Slot } from '../@types/hotkeys';

//	Variables __________________________________________________________________

export const FIRST_SLOT = 1;

export type SlotMutationReason = 'boundary'|'empty-source'|'invalid-index'|'no-change';

export type SlotMutationResult = {
	slots: Slot[],
	changed: boolean,
	reason?: SlotMutationReason,
};

//	Initialize _________________________________________________________________



//	Exports ____________________________________________________________________

export function insertSlot (slots: Slot[], selectedSlot: Slot, index: number): SlotMutationResult {

	if (!isValidIndex(index)) return unchanged(slots, 'invalid-index');

	const result = copySlots(slots);
	const sourceIndex = findSlotIndex(result, selectedSlot);

	if (sourceIndex === index) return unchanged(result, 'no-change');

	if (sourceIndex) removeAndClose(result, sourceIndex);

	for (let i = findLastOccupiedSlot(result); i >= index; i--) setSlot(result, i + 1, result[i]);
	setSlot(result, index, selectedSlot);

	return changed(result);

}

export function dropSlot (slots: Slot[], sourceIndex: number, targetIndex?: number): SlotMutationResult {

	if (!isValidIndex(sourceIndex)) return unchanged(slots, 'invalid-index');
	if (!slots[sourceIndex]) return unchanged(slots, 'empty-source');

	const index = targetIndex === undefined ? findLastOccupiedSlot(slots) : targetIndex;

	return insertSlot(slots, slots[sourceIndex], index);

}

export function moveSlot (slots: Slot[], index: number, offset: -1|1): SlotMutationResult {

	if (!isValidIndex(index)) return unchanged(slots, 'invalid-index');
	if (!slots[index]) return unchanged(slots, 'empty-source');

	const occupiedIndexes = getOccupiedSlotIndexes(slots);
	const position = occupiedIndexes.indexOf(index);
	const targetIndex = occupiedIndexes[position + offset];

	if (!targetIndex) return unchanged(slots, 'boundary');

	const result = copySlots(slots);
	const source = result[index];
	const target = result[targetIndex];

	setSlot(result, targetIndex, source);
	setSlot(result, index, target);

	return changed(result);

}

export function removeSlotAndClose (slots: Slot[], index: number): SlotMutationResult {

	if (!isValidIndex(index)) return unchanged(slots, 'invalid-index');
	if (!slots[index]) return unchanged(slots, 'empty-source');

	const result = copySlots(slots);

	removeAndClose(result, index);

	return changed(result);

}

export function findFirstOccupiedSlot (slots: Slot[]) {

	for (let i = FIRST_SLOT; i < slots.length; i++) {
		if (slots[i]) return i;
	}

	return 0;

}

export function findLastOccupiedSlot (slots: Slot[]) {

	for (let i = slots.length - 1; i >= FIRST_SLOT; i--) {
		if (slots[i]) return i;
	}

	return 0;

}

export function findAdjacentOccupiedSlot (slots: Slot[], index: number, offset: -1|1) {

	const occupiedIndexes = getOccupiedSlotIndexes(slots);

	if (!occupiedIndexes.length) return 0;
	if (!isValidIndex(index)) return offset === 1 ? occupiedIndexes[0] : occupiedIndexes[occupiedIndexes.length - 1];

	if (offset === 1) {
		return occupiedIndexes.find((candidate) => candidate > index) || occupiedIndexes[0];
	}

	return occupiedIndexes.slice().reverse().find((candidate) => candidate < index)
		|| occupiedIndexes[occupiedIndexes.length - 1];

}

export function findCurrentWorkspaceSlot (slots: Slot[], workspacePath: string, preferredIndex = 0) {

	if (!workspacePath) return 0;

	for (let i = FIRST_SLOT; i < slots.length; i++) {
		if (slots[i]?.path === workspacePath) return i;
	}

	if (slots[preferredIndex]?.paths?.includes(workspacePath)) return preferredIndex;

	for (let i = FIRST_SLOT; i < slots.length; i++) {
		if (slots[i]?.paths?.includes(workspacePath)) return i;
	}

	return 0;

}

export function findSlotIndex (slots: Slot[], selectedSlot: Slot) {

	for (let i = FIRST_SLOT; i < slots.length; i++) {
		if (isSameSlot(slots[i], selectedSlot)) return i;
	}

	return 0;

}

export function getOccupiedSlotIndexes (slots: Slot[]) {

	const indexes: number[] = [];

	for (let i = FIRST_SLOT; i < slots.length; i++) {
		if (slots[i]) indexes.push(i);
	}

	return indexes;

}

export function getNextSlotIndex (slots: Slot[]) {

	return findLastOccupiedSlot(slots) + 1;

}

//	Functions __________________________________________________________________

function changed (slots: Slot[]): SlotMutationResult {

	return { slots, changed: true };

}

function unchanged (slots: Slot[], reason: SlotMutationReason): SlotMutationResult {

	return { slots: copySlots(slots), changed: false, reason };

}

function copySlots (slots: Slot[]) {

	const result: Slot[] = [];

	for (const index of getOccupiedSlotIndexes(slots)) setSlot(result, index, slots[index]);

	return result;

}

function isSameSlot (slotA: Slot, slotB: Slot) {

	if (!slotA || !slotB) return false;
	if (slotA.path || slotB.path) return Boolean(slotA.path && slotA.path === slotB.path);
	if (slotA.groupId !== undefined || slotB.groupId !== undefined) {
		return slotA.groupId !== undefined && slotA.groupId === slotB.groupId;
	}
	if (slotA.tagId !== undefined || slotB.tagId !== undefined) {
		return slotA.tagId !== undefined && slotA.tagId === slotB.tagId;
	}

	return false;

}

function isValidIndex (index: number) {

	return Number.isInteger(index) && index >= FIRST_SLOT;

}

function removeAndClose (slots: Slot[], index: number) {

	const lastSlot = findLastOccupiedSlot(slots);

	for (let i = index; i < lastSlot; i++) setSlot(slots, i, slots[i + 1]);
	delete slots[lastSlot];

}

function setSlot (slots: Slot[], index: number, slot: Slot) {

	if (slot) slots[index] = { ...slot, index };
	else delete slots[index];

}
