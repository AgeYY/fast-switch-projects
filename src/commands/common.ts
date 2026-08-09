//	Imports ____________________________________________________________________

import * as vscode from 'vscode';

import type { CommonGroupTreeItems } from '../@types/common';
import type { Project } from '../@types/workspaces';

import * as commands from '../common/commands';
import * as files from '../common/files';
import * as sessions from '../common/sessions';
import * as states from '../common/states';
import { scheduleCrossWindowRefresh } from '../common/stateSync';
import * as terminal from '../common/terminal';
import { createUri, dirname } from '../common/uris';
import { getCurrentWorkspacePath } from '../common/workspaces';

import { FavoriteGroupTreeItem } from '../sidebar/trees/groups/FavoriteGroupTreeItem';
import { WorkspaceGroupTreeItem } from '../sidebar/trees/groups/WorkspaceGroupTreeItem';
import { TagTreeItem } from '../sidebar/trees/items/TagTreeItem';
import { WorkspaceTreeItem } from '../sidebar/trees/items/WorkspaceTreeItem';

import { FavoritesProvider } from '../sidebar/FavoritesProvider';
import { TagsProvider } from '../sidebar/TagsProvider';
import { WorkspacesProvider } from '../sidebar/WorkspacesProvider';

import { FavoriteGroupsState } from '../states/FavoriteGroupsState';
import { FavoritesState } from '../states/FavoritesState';
import { HotkeySlotsState } from '../states/HotkeySlotsState';
import { ProjectsState } from '../states/ProjectsState';
import { SessionsState } from '../states/SessionsState';
import { TagsState } from '../states/TagsState';
import { WorkspaceGroupsState } from '../states/WorkspaceGroupsState';
import { WorkspacesState } from '../states/WorkspacesState';

//	Variables __________________________________________________________________



//	Initialize _________________________________________________________________



//	Exports ____________________________________________________________________

export function activate (context: vscode.ExtensionContext) {
	
	const projectsState = ProjectsState.create(context);
	const sessionsState = SessionsState.create(context);
	const session = sessionsState.current();
	
	if (session) {
		sessionsState.clear();
		sessions.openSession(session.paths, projectsState);
		vscode.commands.executeCommand('workbench.view.explorer');
	}
	
	const favoritesState = FavoritesState.create(context);
	const favoriteGroupsState = FavoriteGroupsState.create(context);
	
	const hotkeySlots = HotkeySlotsState.create(context);
	
	const tagsState = TagsState.create(context);
	
	const workspacesState = WorkspacesState.create(context);
	const workspaceGroupsState = WorkspaceGroupsState.create(context);
	
	let previousLastModified = states.getStateInfo(context).lastModified;
	const refreshTimeouts: NodeJS.Timeout[] = [];

	function refreshIfChanged () {

		const currentLastModified = states.getStateInfo(context).lastModified;

		if (previousLastModified === currentLastModified) return;

		previousLastModified = currentLastModified;

		const tags = tagsState.get();

		hotkeySlots.saveCurrentWorkspace();
		hotkeySlots.refresh();

		FavoritesProvider.current?.refresh({
			favorites: favoritesState.get(),
			favoriteGroups: favoriteGroupsState.get(),
			tags,
		});

		if (workspacesState.cache) {
			WorkspacesProvider.current?.refresh({
				workspaces: workspacesState.get(),
				workspaceGroups: workspaceGroupsState.get(),
				tags,
			});
		}

		TagsProvider.current?.refresh({
			tags,
		});

	}

	function clearRefreshTimeouts () {

		while (refreshTimeouts.length) clearTimeout(refreshTimeouts.pop());

	}

	context.subscriptions.push(new vscode.Disposable(clearRefreshTimeouts));
	
	context.subscriptions.push(vscode.window.onDidChangeWindowState(({ focused }) => {
		
		if (focused) { // Update data if changes in another workspace have been done
			clearRefreshTimeouts();
			refreshTimeouts.push(...scheduleCrossWindowRefresh(refreshIfChanged));
		} else {
			clearRefreshTimeouts();
		}
		
	}));

	// A newly opened window can already be focused before this listener is registered.
	// Retry briefly during activation so state propagated from the creating window is rendered.
	refreshTimeouts.push(...scheduleCrossWindowRefresh(refreshIfChanged));
	
	commands.register(context, {
		'fastSwitchProjects.action.explorer.openInNewWindow': (uri: vscode.Uri) => vscode.commands.executeCommand('vscode.openFolder', uri, true),
		'fastSwitchProjects.action.explorer.openInCurrentWindow': (uri: vscode.Uri) => vscode.commands.executeCommand('vscode.openFolder', uri, false),
		'fastSwitchProjects.action.explorer.copyUri': (uri: vscode.Uri) => vscode.env.clipboard.writeText(uri.toString()),
		
		'fastSwitchProjects.action.workspace.revealInFinder': (item: WorkspaceTreeItem) => files.reveal(item?.project.path || getCurrentWorkspacePath()),
		'fastSwitchProjects.action.workspace.revealInExplorer': (item: WorkspaceTreeItem) => files.reveal(item?.project.path || getCurrentWorkspacePath()),
		'fastSwitchProjects.action.workspace.openContainingFolder': (item: WorkspaceTreeItem) => files.reveal(item?.project.path || getCurrentWorkspacePath()),
		'fastSwitchProjects.action.workspace.openInTerminal': ({ project }: WorkspaceTreeItem) => terminal.open(<string>getFolderPath(project)),
		'fastSwitchProjects.action.workspace.copyPath': ({ project }: WorkspaceTreeItem) => vscode.env.clipboard.writeText(createUri(project.path).path),
		'fastSwitchProjects.action.workspace.copyUri': ({ project }: WorkspaceTreeItem) => vscode.env.clipboard.writeText(createUri(project.path).toString()),
		
		'fastSwitchProjects.action.group.openAllInCurrentAndNewWindows': ({ group }: CommonGroupTreeItems) => sessions.openMultipleWindows(group, false),
		'fastSwitchProjects.action.group.openAllInNewWindows': ({ group }: CommonGroupTreeItems) => sessions.openMultipleWindows(group, true),
		
		'fastSwitchProjects.action.group.addFoldersToWorkspace': ({ group }: FavoriteGroupTreeItem|WorkspaceGroupTreeItem) => {
			
			sessions.addFoldersToWorkspace(group.paths, projectsState);
			
		},
		
		'fastSwitchProjects.action.group.openAsWorkspace': ({ group }: FavoriteGroupTreeItem|WorkspaceGroupTreeItem) => {
			
			sessions.openAsWorkspace(group.paths, sessionsState, projectsState);
			
		},
		
		'fastSwitchProjects.action.tag.openAllInCurrentAndNewWindows': ({ tag }: TagTreeItem) => sessions.openMultipleWindows(tag, false),
		'fastSwitchProjects.action.tag.openAllInNewWindows': ({ tag }: TagTreeItem) => sessions.openMultipleWindows(tag, true),
		
		'fastSwitchProjects.action.tag.addFoldersToWorkspace': ({ tag }: TagTreeItem) => {
			
			sessions.addFoldersToWorkspace(tag.paths, projectsState);
			
		},
		
		'fastSwitchProjects.action.tag.openAsWorkspace': ({ tag }: TagTreeItem) => {
			
			sessions.openAsWorkspace(tag.paths, sessionsState, projectsState);
			
		},
	});

}

//	Functions __________________________________________________________________

function getFolderPath (project: Project) {
	
	return project.type === 'folders' || project.type === 'workspace' ? dirname(project.path) : project.path;
	
}
