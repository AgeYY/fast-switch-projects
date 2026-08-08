//	Imports ____________________________________________________________________

import * as vscode from 'vscode';

import {
	decodeSlotDragPayload,
	encodeSlotDragPayload,
	SLOT_DRAG_MIME_TYPE,
} from '../common/slotDragAndDrop';

import type { HotkeySlotsState } from '../states/HotkeySlotsState';

import type { SlotTreeItem } from './trees/items/SlotTreeItem';

//	Variables __________________________________________________________________



//	Initialize _________________________________________________________________



//	Exports ____________________________________________________________________

export class SlotsDragAndDropController implements vscode.TreeDragAndDropController<SlotTreeItem> {

	public readonly dragMimeTypes = [SLOT_DRAG_MIME_TYPE];
	public readonly dropMimeTypes = [SLOT_DRAG_MIME_TYPE];

	public constructor (private readonly slotsState: HotkeySlotsState) {}

	public handleDrag (source: readonly SlotTreeItem[], dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken) {

		if (token.isCancellationRequested || source.length !== 1 || !source[0].slot) return;

		dataTransfer.set(SLOT_DRAG_MIME_TYPE, new vscode.DataTransferItem(encodeSlotDragPayload(source[0].index)));

	}

	public async handleDrop (target: SlotTreeItem|undefined, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken) {

		const item = dataTransfer.get(SLOT_DRAG_MIME_TYPE);

		if (!item || token.isCancellationRequested) return;

		const sourceIndex = decodeSlotDragPayload(await item.asString());

		if (!sourceIndex || token.isCancellationRequested) return;

		this.slotsState.drop(sourceIndex, target?.index);

	}

}

//	Functions __________________________________________________________________
