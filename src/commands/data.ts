//	Imports ____________________________________________________________________

import * as fs from 'fs';
import * as vscode from 'vscode';

import type { Favorite, FavoriteGroup } from '../@types/favorites';
import type { Slot } from '../@types/hotkeys';
import type { Tag } from '../@types/tags';
import type { Project, WorkspaceGroup } from '../@types/workspaces';

import * as commands from '../common/commands';
import * as states from '../common/states';

//	Variables __________________________________________________________________

type Backup = {
	favorites: Favorite[],
	favoriteGroups: FavoriteGroup[],
	projects: Project[],
	slots: Slot[],
	tags: Tag[],
	workspaceGroups: WorkspaceGroup[],
};

//	Initialize _________________________________________________________________



//	Exports ____________________________________________________________________

export function activate (context: vscode.ExtensionContext) {

	commands.register(context, {
		'fastSwitchProjects.action.data.export': () => exportData(context),
		'fastSwitchProjects.action.data.import': () => importData(context),
	});

}

//	Functions __________________________________________________________________

async function exportData (context: vscode.ExtensionContext) {

	const uri = await vscode.window.showSaveDialog({
		filters: { JSON: ['json'] },
		saveLabel: 'Export Fast Switch Projects Data',
		title: 'Export Fast Switch Projects Data',
	});

	if (!uri) return;

	fs.writeFileSync(uri.fsPath, JSON.stringify(createBackup(context), null, '\t'), 'utf-8');
	vscode.window.showInformationMessage(`Exported Fast Switch Projects data to "${uri.fsPath}".`);

}

async function importData (context: vscode.ExtensionContext) {

	const uris = await vscode.window.showOpenDialog({
		canSelectFiles: true,
		canSelectFolders: false,
		canSelectMany: false,
		filters: { JSON: ['json'] },
		openLabel: 'Import Fast Switch Projects Data',
		title: 'Import Fast Switch Projects Data',
	});

	if (!uris?.length) return;

	let backup: Backup;

	try {
		backup = <Backup>JSON.parse(fs.readFileSync(uris[0].fsPath, 'utf-8'));
		validateBackup(backup);
	} catch (error) {
		vscode.window.showErrorMessage(`Could not import Fast Switch Projects data: ${(<Error>error).message}`);
		return;
	}

	const answer = await vscode.window.showWarningMessage('Importing replaces the current Fast Switch Projects data. Continue?', {
		modal: true,
	}, 'Import');

	if (answer !== 'Import') return;

	states.updateFavorites(context, backup.favorites);
	states.updateFavoriteGroups(context, backup.favoriteGroups);
	states.updateProjects(context, backup.projects);
	states.updateSlots(context, backup.slots);
	states.updateTags(context, backup.tags);
	states.updateWorkspaceGroups(context, backup.workspaceGroups);

	const reload = await vscode.window.showInformationMessage('Imported Fast Switch Projects data.', 'Reload Window');

	if (reload) vscode.commands.executeCommand('workbench.action.reloadWindow');

}

function createBackup (context: vscode.ExtensionContext): Backup {

	return {
		favorites: states.getFavorites(context),
		favoriteGroups: states.getFavoriteGroups(context),
		projects: states.getProjects(context),
		slots: states.getSlots(context),
		tags: states.getTags(context),
		workspaceGroups: states.getWorkspaceGroups(context),
	};

}

function validateBackup (backup: Backup) {

	if (!backup || !Array.isArray(backup.favorites)
		|| !Array.isArray(backup.favoriteGroups)
		|| !Array.isArray(backup.projects)
		|| !Array.isArray(backup.slots)
		|| !Array.isArray(backup.tags)
		|| !Array.isArray(backup.workspaceGroups)) {
		throw new Error('the selected file is not a valid Projects backup');
	}

}
