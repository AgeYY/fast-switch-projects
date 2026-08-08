//	Imports ____________________________________________________________________

import * as vscode from 'vscode';

import * as dialogs from '../common/dialogs';

import type { FavoriteGroup } from '../@types/favorites';
import type { Item, Slot } from '../@types/hotkeys';
import type { Tag } from '../@types/tags';
import type { Project, WorkspaceGroup } from '../@types/workspaces';

import type { HotkeySlotsState } from '../states/HotkeySlotsState';
import type { SlotMutationResult } from '../common/slots';
import { FIRST_SLOT, getNextSlotIndex, getOccupiedSlotIndexes } from '../common/slots';

//	Variables __________________________________________________________________



//	Initialize _________________________________________________________________



//	Exports ____________________________________________________________________

export class HotkeySlotsDialog {
	
	private static current: HotkeySlotsDialog;
	
	public static create (hotkeySlotsState: HotkeySlotsState) {
		
		return HotkeySlotsDialog.current || (HotkeySlotsDialog.current = new HotkeySlotsDialog(hotkeySlotsState));
		
	}
	
	private constructor (private readonly hotkeySlotsState: HotkeySlotsState) {}
	
	public async assignWorkspace (project: Project) {
		
		const item = await this.createQuickPickDialog();
		
		if (item) this.hotkeySlotsState.assign(project, item.index);
		
	}
	
	public async assignGroup (group: FavoriteGroup|WorkspaceGroup) {
		
		const item = await this.createQuickPickDialog();
		
		if (item) this.hotkeySlotsState.assignGroup(group, item.index);
		
	}
	
	public async assignTag (tag: Tag) {
		
		const item = await this.createQuickPickDialog();
		
		if (item) this.hotkeySlotsState.assignTag(tag, item.index);
		
	}

	public async insertWorkspace (project: Project) {

		const item = await this.createQuickPickDialog('Please select where to insert the workspace.');

		if (item) this.showMutationResult(this.hotkeySlotsState.insertWorkspace(project, item.index));

	}

	public async insertGroup (group: FavoriteGroup|WorkspaceGroup) {

		const item = await this.createQuickPickDialog('Please select where to insert the group.');

		if (item) this.showMutationResult(this.hotkeySlotsState.insertGroup(group, item.index));

	}

	public async insertTag (tag: Tag) {

		const item = await this.createQuickPickDialog('Please select where to insert the tag.');

		if (item) this.showMutationResult(this.hotkeySlotsState.insertTag(tag, item.index));

	}

	public async insertExisting (index?: number) {

		const source = index || (await this.selectAssignedSlot('Please select the slot to move.'))?.index;

		if (!source) return;

		const target = await this.createQuickPickDialog('Please select the new slot position.');

		if (target) this.showMutationResult(this.hotkeySlotsState.insertExisting(source, target.index));

	}

	public async move (offset: -1|1, index?: number) {

		const source = index || (await this.selectAssignedSlot('Please select the slot to move.'))?.index;

		if (source) this.showMutationResult(this.hotkeySlotsState.move(source, offset));

	}

	public async removeAndClose (index?: number) {

		const source = index || (await this.selectAssignedSlot('Please select the slot to remove.'))?.index;

		if (source) this.showMutationResult(this.hotkeySlotsState.removeAndClose(source));

	}

	public async createQuickPickDialog (placeHolder = 'Please select a slot for the workspace.') {
		
		const slots = this.hotkeySlotsState.get();
		const items: Item[] = [];
		
		for (let i = FIRST_SLOT; i <= getNextSlotIndex(slots); i++) {
			items.push({
				label: `Slot ${i}`,
				index: i,
				description: formatDescription(slots[i]),
			});
		}
		
		return await vscode.window.showQuickPick(items, {
			placeHolder,
		});
		
	}

	public selectAssignedSlot (placeHolder = 'Please select a slot to open.') {

		const slots = this.hotkeySlotsState.get();
		const items: Item[] = [];

		for (const index of getOccupiedSlotIndexes(slots)) {
			items.push({
				label: `Slot ${index}: ${slots[index].label}`,
				index,
				description: formatDescription(slots[index]),
			});
		}

		return vscode.window.showQuickPick(items, { placeHolder });

	}
	
	public async remove () {
		
		const slots = this.hotkeySlotsState.get();
		const items: Item[] = [];
		
		for (const index of getOccupiedSlotIndexes(slots)) {
			items.push({
				label: `Slot ${index}`,
				index,
				description: formatDescription(slots[index]),
			});
		}
		
		const item = await vscode.window.showQuickPick(items, {
			placeHolder: 'Please select the slot which should be cleared.',
		});
		
		if (item) this.hotkeySlotsState.remove(item.index);
		
	}
	
	public async clear () {
		
		if (await dialogs.confirm('Delete all hotkey slots?', 'Delete')) {
			this.hotkeySlotsState.clear();
		}
		
	}

	private showMutationResult (result: SlotMutationResult) {

		if (result.changed || result.reason === 'no-change') return;

		if (result.reason === 'boundary') {
			vscode.window.showInformationMessage('The slot is already at the boundary.');
		} else if (result.reason === 'empty-source') {
			vscode.window.showInformationMessage('The selected slot is empty.');
		}

	}

}

//	Functions __________________________________________________________________

function formatDescription (slot: Slot) {
	
	if (!slot) return '';
	
	if ('tagId' in slot) return `$(tag) ${slot.label}`;
	
	return slot.label;
	
}
