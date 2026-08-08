//	Imports ____________________________________________________________________

import * as assert from 'assert';

import {
	decodeSlotDragPayload,
	encodeSlotDragPayload,
	SLOT_DRAG_MIME_TYPE,
} from './slotDragAndDrop';

//	Variables __________________________________________________________________



//	Initialize _________________________________________________________________

describe('slotDragAndDrop', () => {

	it('uses the Slots tree private MIME type', () => {

		assert.strictEqual(SLOT_DRAG_MIME_TYPE, 'application/vnd.code.tree.l13projectsslots');

	});

	it('round trips a valid occupied-slot index', () => {

		assert.strictEqual(decodeSlotDragPayload(encodeSlotDragPayload(12)), 12);

	});

	it('rejects malformed and invalid drag payloads safely', () => {

		assert.strictEqual(decodeSlotDragPayload('not-json'), 0);
		assert.strictEqual(decodeSlotDragPayload('{}'), 0);
		assert.strictEqual(decodeSlotDragPayload('{"index":0}'), 0);
		assert.strictEqual(decodeSlotDragPayload('{"index":2.5}'), 0);
		assert.strictEqual(decodeSlotDragPayload('{"index":"2"}'), 0);

	});

});

//	Exports ____________________________________________________________________



//	Functions __________________________________________________________________
