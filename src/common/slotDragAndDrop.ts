//	Imports ____________________________________________________________________

import { FIRST_SLOT } from './slots';

//	Variables __________________________________________________________________

export const SLOT_DRAG_MIME_TYPE = 'application/vnd.code.tree.l13projectsslots';

type SlotDragPayload = {
	index: number,
};

//	Initialize _________________________________________________________________



//	Exports ____________________________________________________________________

export function encodeSlotDragPayload (index: number) {

	return JSON.stringify({ index });

}

export function decodeSlotDragPayload (value: string) {

	try {
		const payload: SlotDragPayload = JSON.parse(value);

		return Number.isInteger(payload?.index) && payload.index >= FIRST_SLOT ? payload.index : 0;
	} catch {
		return 0;
	}

}

//	Functions __________________________________________________________________
