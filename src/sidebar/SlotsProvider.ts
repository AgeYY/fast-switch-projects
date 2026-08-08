//	Imports ____________________________________________________________________

import * as vscode from 'vscode';

import { getOccupiedSlotIndexes } from '../common/slots';

import type { HotkeySlotsState } from '../states/HotkeySlotsState';

import { SlotTreeItem } from './trees/items/SlotTreeItem';

//	Variables __________________________________________________________________



//	Initialize _________________________________________________________________



//	Exports ____________________________________________________________________

export class SlotsProvider implements vscode.TreeDataProvider<SlotTreeItem> {

	private _onDidChangeTreeData: vscode.EventEmitter<SlotTreeItem|undefined> = new vscode.EventEmitter<SlotTreeItem|undefined>();
	public readonly onDidChangeTreeData: vscode.Event<SlotTreeItem|undefined> = this._onDidChangeTreeData.event;

	public constructor (private readonly slotsState: HotkeySlotsState) {}

	public refresh () {

		this._onDidChangeTreeData.fire(undefined);

	}

	public getTreeItem (element: SlotTreeItem) {

		return element;

	}

	public getChildren () {

		const items: SlotTreeItem[] = [];
		const slots = this.slotsState.get();
		const currentIndex = this.slotsState.getCurrentWorkspaceIndex();

		for (const index of getOccupiedSlotIndexes(slots)) {
			items.push(new SlotTreeItem(index, slots[index], index === currentIndex));
		}

		return items;

	}

}

//	Functions __________________________________________________________________
