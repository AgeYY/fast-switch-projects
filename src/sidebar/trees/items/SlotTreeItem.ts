//	Imports ____________________________________________________________________

import { ThemeColor, ThemeIcon, TreeItem } from 'vscode';

import type { Slot } from '../../../@types/hotkeys';

//	Variables __________________________________________________________________



//	Initialize _________________________________________________________________



//	Exports ____________________________________________________________________

export class SlotTreeItem extends TreeItem {

	public readonly contextValue: 'empty-slot'|'slot';

	public constructor (public readonly index: number, public readonly slot?: Slot, isCurrent = false) {

		super(slot ? `${index}. ${slot.label}` : `${index}. (empty)`);

		this.contextValue = slot ? 'slot' : 'empty-slot';
		this.description = slot ? getDescription(slot, isCurrent) : '';
		this.iconPath = new ThemeIcon(slot ? getSlotIcon(slot) : 'circle-outline');

		if (isCurrent) this.iconPath = new ThemeIcon('arrow-left', new ThemeColor('charts.green'));

		if (slot) {
			this.command = {
				arguments: [this],
				command: 'fastSwitchProjects.action.hotkeys.openSlot',
				title: 'Open Slot',
			};
			this.tooltip = `Open slot ${index}: ${slot.label}`;

			if (isCurrent) this.tooltip = `Current workspace • ${this.tooltip}`;
		}

	}

}

//	Functions __________________________________________________________________

function getSlotIcon (slot: Slot) {

	if (slot.tagId !== undefined) return 'tag';
	if (slot.groupId !== undefined) return 'folder-library';

	return 'root-folder';

}

function getSlotType (slot: Slot) {

	if (slot.tagId !== undefined) return 'Tag';
	if (slot.groupId !== undefined) return 'Group';

	return 'Workspace';

}

function getDescription (slot: Slot, isCurrent: boolean) {

	const type = getSlotType(slot);

	return isCurrent ? `Current Workspace • ${type}` : type;

}
