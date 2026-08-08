//	Imports ____________________________________________________________________

import * as vscode from 'vscode';

import * as commands from '../common/commands';
import * as files from '../common/files';
import {
	findAdjacentOccupiedSlot,
	findFirstOccupiedSlot,
	findLastOccupiedSlot,
} from '../common/slots';

import { HotkeySlotsDialog } from '../dialogs/HotkeySlotsDialog';
import { TagsDialog } from '../dialogs/TagsDialog';

import { FavoritesProvider } from '../sidebar/FavoritesProvider';
import { SlotsDragAndDropController } from '../sidebar/SlotsDragAndDropController';
import { SlotsProvider } from '../sidebar/SlotsProvider';
import { TagsProvider } from '../sidebar/TagsProvider';
import { WorkspacesProvider } from '../sidebar/WorkspacesProvider';
import { SlotTreeItem } from '../sidebar/trees/items/SlotTreeItem';

import { HotkeySlotsState } from '../states/HotkeySlotsState';
import { ProjectsState } from '../states/ProjectsState';
import { TagsState } from '../states/TagsState';
import { WorkspacesState } from '../states/WorkspacesState';

//	Variables __________________________________________________________________

type NavigationDirection = 'first'|'last'|'next'|'previous';


//	Initialize _________________________________________________________________



//	Exports ____________________________________________________________________

export function activate (context: vscode.ExtensionContext) {
	
	const hotkeySlotsState = HotkeySlotsState.create(context);
	const projectsState = ProjectsState.create(context);
	const tagsState = TagsState.create(context);
	const workspacesState = WorkspacesState.create(context);
	
	const tagsDialog = TagsDialog.create(tagsState, workspacesState, projectsState);
	const hotkeySlotsDialog = HotkeySlotsDialog.create(hotkeySlotsState);
	const slotsProvider = new SlotsProvider(hotkeySlotsState);
	const slotsDragAndDropController = new SlotsDragAndDropController(hotkeySlotsState);
	const slotsTreeView = vscode.window.createTreeView('fastSwitchProjectsSlots', {
		dragAndDropController: slotsDragAndDropController,
		treeDataProvider: slotsProvider,
	});

	context.subscriptions.push(slotsTreeView);
	context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => slotsProvider.refresh()));
	
	context.subscriptions.push(hotkeySlotsState.onDidChangeSlots(() => {
		
		FavoritesProvider.current?.refresh();
		slotsProvider.refresh();
		WorkspacesProvider.current?.refresh();
		TagsProvider.current?.refresh();
		
	}));
	
	hotkeySlotsState.saveCurrentWorkspace();
	
	commands.register(context, {
		'fastSwitchProjects.action.workspace.assignSlot': ({ project }) => hotkeySlotsDialog.assignWorkspace(project),
		'fastSwitchProjects.action.group.assignSlot': ({ group }) => hotkeySlotsDialog.assignGroup(group),
		'fastSwitchProjects.action.tag.assignSlot': ({ tag }) => hotkeySlotsDialog.assignTag(tag),
		'fastSwitchProjects.action.workspace.insertSlot': ({ project }) => hotkeySlotsDialog.insertWorkspace(project),
		'fastSwitchProjects.action.group.insertSlot': ({ group }) => hotkeySlotsDialog.insertGroup(group),
		'fastSwitchProjects.action.tag.insertSlot': ({ tag }) => hotkeySlotsDialog.insertTag(tag),

		'fastSwitchProjects.action.hotkeys.insertSlot': (item?: SlotTreeItem) => hotkeySlotsDialog.insertExisting(item?.index),
		'fastSwitchProjects.action.hotkeys.moveSlotUp': (item?: SlotTreeItem) => hotkeySlotsDialog.move(-1, item?.index),
		'fastSwitchProjects.action.hotkeys.moveSlotDown': (item?: SlotTreeItem) => hotkeySlotsDialog.move(1, item?.index),
		'fastSwitchProjects.action.hotkeys.removeSlotAndClose': (item?: SlotTreeItem) => hotkeySlotsDialog.removeAndClose(item?.index),
		'fastSwitchProjects.action.hotkeys.openSlot': async (item?: SlotTreeItem) => {

			const index = item?.index || (await hotkeySlotsDialog.selectAssignedSlot())?.index;

			if (index) await openSlot(hotkeySlotsState, tagsState, tagsDialog, index);

		},
		
		'fastSwitchProjects.action.hotkey.slot1': () => openSlot(hotkeySlotsState, tagsState, tagsDialog, 1),
		'fastSwitchProjects.action.hotkey.slot2': () => openSlot(hotkeySlotsState, tagsState, tagsDialog, 2),
		'fastSwitchProjects.action.hotkey.slot3': () => openSlot(hotkeySlotsState, tagsState, tagsDialog, 3),
		'fastSwitchProjects.action.hotkey.slot4': () => openSlot(hotkeySlotsState, tagsState, tagsDialog, 4),
		'fastSwitchProjects.action.hotkey.slot5': () => openSlot(hotkeySlotsState, tagsState, tagsDialog, 5),
		'fastSwitchProjects.action.hotkey.slot6': () => openSlot(hotkeySlotsState, tagsState, tagsDialog, 6),
		'fastSwitchProjects.action.hotkey.slot7': () => openSlot(hotkeySlotsState, tagsState, tagsDialog, 7),
		'fastSwitchProjects.action.hotkey.slot8': () => openSlot(hotkeySlotsState, tagsState, tagsDialog, 8),
		'fastSwitchProjects.action.hotkey.slot9': () => openSlot(hotkeySlotsState, tagsState, tagsDialog, 9),
		'fastSwitchProjects.action.hotkey.nextSlot': () => navigateSlot(hotkeySlotsState, tagsState, tagsDialog, 'next'),
		'fastSwitchProjects.action.hotkey.previousSlot': () => navigateSlot(hotkeySlotsState, tagsState, tagsDialog, 'previous'),
		'fastSwitchProjects.action.hotkey.firstSlot': () => navigateSlot(hotkeySlotsState, tagsState, tagsDialog, 'first'),
		'fastSwitchProjects.action.hotkey.lastSlot': () => navigateSlot(hotkeySlotsState, tagsState, tagsDialog, 'last'),
		
		'fastSwitchProjects.action.hotkey.previousWorkspace': () => {
			
			const previousWorkspace = hotkeySlotsState.getPreviousWorkspace();
			
			if (previousWorkspace) files.open(previousWorkspace);
			
		},
		
		'fastSwitchProjects.action.hotkeys.clearSlot': () => hotkeySlotsDialog.remove(),
		'fastSwitchProjects.action.hotkeys.clearAllSlots': () => hotkeySlotsDialog.clear(),
	});
	
}

//	Functions __________________________________________________________________

async function openSlot (hotkeySlotsState: HotkeySlotsState, tagsState: TagsState, tagsDialog: TagsDialog, index: number) {
	
	const slots = hotkeySlotsState.get();
	const slot = slots[index];
	
	if (slot) {
		await hotkeySlotsState.rememberOpenedSlot(index);
		if ('tagId' in slot) tagsDialog.open(tagsState.getById(slot.tagId));
		else if ('groupId' in slot) files.openAll(slot.paths);
		else files.open(slot.path);
	}
	
}

async function navigateSlot (hotkeySlotsState: HotkeySlotsState, tagsState: TagsState,
	tagsDialog: TagsDialog, direction: NavigationDirection) {

	const slots = hotkeySlotsState.get();
	let index = 0;

	if (direction === 'first') index = findFirstOccupiedSlot(slots);
	else if (direction === 'last') index = findLastOccupiedSlot(slots);
	else index = findAdjacentOccupiedSlot(slots, hotkeySlotsState.getCurrentIndex(), direction === 'next' ? 1 : -1);

	if (index) await openSlot(hotkeySlotsState, tagsState, tagsDialog, index);
	else vscode.window.showInformationMessage('No project slots are assigned.');

}
