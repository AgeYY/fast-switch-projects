//	Imports ____________________________________________________________________

import * as vscode from 'vscode';

import { formatAmount } from '../@l13/formats';
import { pluralEntries } from '../@l13/units/files';

import type { GroupTreeItems, Project } from '../@types/workspaces';

import * as commands from '../common/commands';
import * as files from '../common/files';
import * as settings from '../common/settings';
import { createUri } from '../common/uris';

import { FavoriteGroupsDialog } from '../dialogs/FavoriteGroupsDialog';
import { ProjectsDialog } from '../dialogs/ProjectsDialog';
import { TagsDialog } from '../dialogs/TagsDialog';
import { WorkspaceGroupsDialog } from '../dialogs/WorkspaceGroupsDialog';
import { WorkspacesDialog } from '../dialogs/WorkspacesDialog';

import { Output } from '../output/Output';

import { WorkspaceGroupTreeItem } from '../sidebar/trees/groups/WorkspaceGroupTreeItem';

import { WorkspaceTreeItem } from '../sidebar/trees/items/WorkspaceTreeItem';

import { CategorySorter } from '../sidebar/trees/sorter/CategorySorter';
import { GroupSorter } from '../sidebar/trees/sorter/GroupSorter';
import { NameSorter } from '../sidebar/trees/sorter/NameSorter';
import { RootSorter } from '../sidebar/trees/sorter/RootSorter';
import { TagSorter } from '../sidebar/trees/sorter/TagSorter';
import { TypeSorter } from '../sidebar/trees/sorter/TypeSorter';

import { WorkspacesProvider } from '../sidebar/WorkspacesProvider';

import { FavoriteGroupsState } from '../states/FavoriteGroupsState';
import { FavoritesState } from '../states/FavoritesState';
import { HotkeySlotsState } from '../states/HotkeySlotsState';
import { ProjectsState } from '../states/ProjectsState';
import { TagsState } from '../states/TagsState';
import { WorkspaceGroupsState } from '../states/WorkspaceGroupsState';
import { WorkspacesState } from '../states/WorkspacesState';

import { colors } from '../statusbar/colors';
import { StatusBarColor } from '../statusbar/StatusBarColor';
import { StatusBarInfo } from '../statusbar/StatusBarInfo';

//	Variables __________________________________________________________________



//	Initialize _________________________________________________________________



//	Exports ____________________________________________________________________

export function activate (context: vscode.ExtensionContext) {
	
	const subscriptions = context.subscriptions;
	
	const output = Output.create();
	const statusBarInfo = StatusBarInfo.create(context);
	
	const favoriteGroupsState = FavoriteGroupsState.create(context);
	const favoritesState = FavoritesState.create(context);
	const hotkeySlotsState = HotkeySlotsState.create(context);
	const projectsState = ProjectsState.create(context);
	const statusBarColorState = StatusBarColor.create(context);
	const tagsState = TagsState.create(context);
	const workspaceGroupsState = WorkspaceGroupsState.create(context);
	const workspacesState = WorkspacesState.create(context);
	
	const projectsDialog = ProjectsDialog.create(projectsState, hotkeySlotsState, workspaceGroupsState);
	const favoriteGroupsDialog = FavoriteGroupsDialog.create(favoriteGroupsState, workspaceGroupsState);
	const tagsDialog = TagsDialog.create(tagsState, workspacesState, projectsState);
	const workspaceGroupsDialog = WorkspaceGroupsDialog.create(workspaceGroupsState, favoriteGroupsState);
	const workspacesDialog = WorkspacesDialog.create(workspacesState, workspaceGroupsState);
	
	const workspacesProvider = WorkspacesProvider.create({
		hotkeySlots: hotkeySlotsState,
		tags: tagsState.get(),
		workspaces: workspacesState.cache,
		workspaceGroups: workspaceGroupsState.get(),
	});
	
	const tagSorter = new TagSorter(workspacesProvider, workspaceGroupsState);
	const groupSorter = new GroupSorter(workspacesProvider, workspaceGroupsState);
	const nameSorter = new NameSorter(workspacesProvider);
	const categorySorter = new CategorySorter(workspacesProvider, workspaceGroupsState);
	const rootSorter = new RootSorter(workspacesProvider, workspaceGroupsState);
	const typeSorter = new TypeSorter(workspacesProvider, workspaceGroupsState);
	
	workspacesProvider.addStaticSorter(tagSorter);
	workspacesProvider.addStaticSorter(groupSorter);
	
	workspacesProvider.addWorkspacesSorter(nameSorter);
	workspacesProvider.addWorkspacesSorter(categorySorter);
	workspacesProvider.addWorkspacesSorter(rootSorter);
	workspacesProvider.addWorkspacesSorter(typeSorter);
	
	const treeView = vscode.window.createTreeView('fastSwitchProjectsWorkspaces', {
		showCollapseAll: true,
		treeDataProvider: workspacesProvider,
	});
	
//	Tree View
	
	subscriptions.push(treeView);
	
	subscriptions.push(treeView.onDidCollapseElement(({ element }) => {
		
		(<GroupTreeItems>element).saveGroupState(workspaceGroupsState, true);
		
	}));
	
	subscriptions.push(treeView.onDidExpandElement(({ element }) => {
		
		(<GroupTreeItems>element).saveGroupState(workspaceGroupsState, false);
		
	}));
	
	subscriptions.push(treeView.onDidChangeSelection((event) => {
		
		if (workspacesProvider.colorPickerProject && event.selection[0] !== workspacesProvider.colorPickerTreeItem) {
			workspacesProvider.colorPickerProject = null;
			workspacesProvider.refresh();
		}
		
	}));
	
//	Workspaces Provider
		
	subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
		
		let hasChanged = false;
		
		if (event.affectsConfiguration('fastSwitchProjects.sortWorkspacesBy')) {
			workspacesProvider.sortWorkspacesBy = settings.get('sortWorkspacesBy');
			hasChanged = true;
		}
		
		if (event.affectsConfiguration('fastSwitchProjects.showTagsInWorkspaces')) {
			workspacesProvider.showTagsInWorkspaces = settings.get('showTagsInWorkspaces');
			hasChanged = true;
		}
		
		if (event.affectsConfiguration('fastSwitchProjects.workspaceDescriptionFormat')) {
			workspacesProvider.workspaceDescriptionFormat = settings.get('workspaceDescriptionFormat');
			hasChanged = true;
		}
		
		if (event.affectsConfiguration('fastSwitchProjects.tagDescriptionFormat')) {
			workspacesProvider.tagDescriptionFormat = settings.get('tagDescriptionFormat');
			hasChanged = true;
		}
		
		if (event.affectsConfiguration('fastSwitchProjects.groupDescriptionFormat')) {
			workspacesProvider.groupDescriptionFormat = settings.get('groupDescriptionFormat');
			hasChanged = true;
		}
		
		if (hasChanged) workspacesProvider.refresh();
		
	}));
	
	subscriptions.push(workspacesProvider.onWillInitView(async () => {
		
		await updateProjectsAndFavorites(statusBarColorState, favoritesState, projectsState);
		
		workspacesProvider.refresh({
			workspaces: await workspacesState.detect(),
		});
		
	}));
	
//	Projects
	
	subscriptions.push(projectsState.onDidUpdateProject((project) => {
		
		favoritesState.update(project);
		hotkeySlotsState.updateWorkspace(project);
		
		workspacesState.refresh();
		statusBarInfo.refresh();
		
	}));

	subscriptions.push(projectsState.onDidDeleteProject((project) => {
		
		if (project.color) settings.updateStatusBarColorSettings(project.path, colors[0]);
		
		workspacesState.refresh();
		
		const workspace = workspacesState.getByPath(project.path);
		
		if (workspace) {
			favoritesState.update(workspace);
			hotkeySlotsState.updateWorkspace(workspace);
		} else {
			favoritesState.remove(project);
			hotkeySlotsState.removeWorkspace(project);
		}
		
		statusBarInfo.refresh();
		
	}));
	
	subscriptions.push(projectsState.onDidChangeProjects(() => {
		
		workspacesState.refresh();
		statusBarInfo.refresh();
		
	}));
	
//	Workspaces
	
	subscriptions.push(workspacesState.onDidChangeWorkspaces((workspaces) => {
		
		workspaceGroupsState.cleanupUnknownPaths(workspaces);
		tagsState.cleanupUnknownPaths(workspaces);
		
		workspacesProvider.refresh({
			workspaces,
		});
		
	}));
	
	output.message('LOG\n');
	
	if (workspacesState.cache) output.log('Using cache for detected projects');
	
	subscriptions.push(workspacesState.onWillScanWorkspaces(() => {
		
		output.message();
		output.log('Start scanning all folders for projects');
		
	}));
	
	subscriptions.push(workspacesState.onWillScanWorkspace(({ path, type }) => {
		
		output.log(`Start scanning folder "${path}" for ${type} projects`);
		
	}));
	
	subscriptions.push(workspacesState.onDidScanWorkspace(({ error, result, type }) => {
		
		if (error) {
			output.log(`Error during scanning folder "${result.root}" for ${type} projects`);
			output.message(`\n${error}\n`);
			vscode.window.showErrorMessage(`${error.message}`, 'Show Output').then((value) => {
				
				if (value) vscode.commands.executeCommand('fastSwitchProjects.action.output.show');
				
			});
		} else output.log(`Finished scanning folder "${result.root}" for ${type} projects. Found ${formatAmount(result.uris.length, pluralEntries)}.`);
		
	}));
	
	subscriptions.push(workspacesState.onDidScanWorkspaces(() => {
		
		output.log('Finished scanning all folders for projects');
		
	}));
	
//	Workspace Groups
	
	subscriptions.push(workspaceGroupsState.onDidUpdateWorkspaceGroup((workspaceGroup) => {
		
		const workspaces = workspaceGroup.paths.map((path) => workspacesState.getByPath(path));
		
		favoriteGroupsState.update(workspaceGroup, workspaces);
		hotkeySlotsState.updateGroup(workspaceGroup);
		
	}));
	
	subscriptions.push(workspaceGroupsState.onDidDeleteWorkspaceGroup((workspaceGroup) => {
		
		favoriteGroupsState.remove(workspaceGroup, true);
		hotkeySlotsState.removeGroup(workspaceGroup);
		
	}));
	
	subscriptions.push(workspaceGroupsState.onDidChangeWorkspaceGroups((workspaceGroups) => {
		
		workspacesProvider.refresh({
			workspaceGroups,
		});
		
	}));
	
//	Status Bar
	
	subscriptions.push(statusBarColorState.onDidChangeColor((project) => {
		
		favoritesState.update(project);
		workspacesState.refresh();
		
	}));
	
//	Tags
	
	subscriptions.push(tagsState.onDidChangeTags((tags) => {
		
		workspacesProvider.refresh({
			tags,
		});
		
	}));
	
//	Commands
	
	commands.register(context, {
		
		'fastSwitchProjects.action.workspace.open': ({ project }: WorkspaceTreeItem) => files.open(project.path),
		'fastSwitchProjects.action.workspace.openInCurrentWindow': ({ project }: WorkspaceTreeItem) => files.open(project.path, false),
		'fastSwitchProjects.action.workspace.openInNewWindow': ({ project }: WorkspaceTreeItem) => files.open(project.path, true),
		
		'fastSwitchProjects.action.workspace.addToWorkspace': ({ project }: WorkspaceTreeItem) => addToWorkspace(project),
		'fastSwitchProjects.action.workspace.addToFavorites': ({ project }: WorkspaceTreeItem) => favoritesState.add(project),
		'fastSwitchProjects.action.workspace.addToGroup': ({ project }: WorkspaceTreeItem) => workspaceGroupsDialog.addWorkspaceToGroup(project),
		'fastSwitchProjects.action.workspace.removeFromGroup': ({ project }: WorkspaceTreeItem) => workspaceGroupsState.removeWorkspace(project),
		
		'fastSwitchProjects.action.workspace.editTags': ({ project }: WorkspaceTreeItem) => tagsDialog.editTags(project),
		
		'fastSwitchProjects.action.workspaces.addProject': () => projectsDialog.addDirectory(),
		'fastSwitchProjects.action.workspaces.addWorkspaceProject': () => projectsDialog.addWorkspaceFile(),
		'fastSwitchProjects.action.workspaces.saveProject': () => projectsDialog.save(),
		'fastSwitchProjects.action.workspace.saveDetectedProject': ({ project }: WorkspaceTreeItem) => projectsDialog.save(project),
		
		'fastSwitchProjects.action.workspaces.pickWorkspace': () => workspacesDialog.pick(),
		
		'fastSwitchProjects.action.workspaces.refresh': () => {
			
			vscode.window.withProgress({
				location: { viewId: 'fastSwitchProjectsWorkspaces' },
			}, async () => {
				
				await updateProjectsAndFavorites(statusBarColorState, favoritesState, projectsState);
				
				await workspacesState.detect();
				
			});
			
		},
		
		'fastSwitchProjects.action.workspaceGroups.add': () => workspaceGroupsDialog.add(),
		'fastSwitchProjects.action.workspaceGroup.addToFavorites': ({ group }: WorkspaceGroupTreeItem) => {
			
			const workspaces = group.paths.map((path) => workspacesState.getByPath(path));
			
			favoriteGroupsDialog.addWorkspaceGroup(group, workspaces.filter((workspace) => !!workspace));
			
		},
		'fastSwitchProjects.action.workspaceGroup.editWorkspaces': ({ group }: WorkspaceGroupTreeItem) => {
			
			workspacesDialog.editWorkspaces(group);
			
		},
		'fastSwitchProjects.action.workspaceGroup.rename': ({ group }: WorkspaceGroupTreeItem) => workspaceGroupsDialog.rename(group),
		'fastSwitchProjects.action.workspaceGroup.remove': ({ group }: WorkspaceGroupTreeItem) => workspaceGroupsDialog.remove(group),
		'fastSwitchProjects.action.workspaceGroups.clear': () => workspaceGroupsDialog.clear(),
		
		'fastSwitchProjects.action.project.rename': ({ project }: WorkspaceTreeItem) => projectsDialog.rename(project),
		'fastSwitchProjects.action.project.remove': ({ project }: WorkspaceTreeItem) => projectsDialog.remove(project),
		'fastSwitchProjects.action.projects.clear': () => projectsDialog.clear(),
		
		'fastSwitchProjects.action.colorPicker.selectColor': ({ project }: WorkspaceTreeItem) => {
			
			workspacesProvider.showColorPicker(project);
			treeView.reveal(workspacesProvider.colorPickerTreeItem, { focus: true, select: true });
			
		},
		
		'fastSwitchProjects.action.colorPicker.pickColor1': () => changeStatusbBarColor(statusBarColorState, workspacesProvider, 1),
		'fastSwitchProjects.action.colorPicker.pickColor2': () => changeStatusbBarColor(statusBarColorState, workspacesProvider, 2),
		'fastSwitchProjects.action.colorPicker.pickColor3': () => changeStatusbBarColor(statusBarColorState, workspacesProvider, 3),
		'fastSwitchProjects.action.colorPicker.pickColor4': () => changeStatusbBarColor(statusBarColorState, workspacesProvider, 4),
		'fastSwitchProjects.action.colorPicker.pickColor5': () => changeStatusbBarColor(statusBarColorState, workspacesProvider, 5),
		'fastSwitchProjects.action.colorPicker.pickColor6': () => changeStatusbBarColor(statusBarColorState, workspacesProvider, 6),
		'fastSwitchProjects.action.colorPicker.pickColor7': () => changeStatusbBarColor(statusBarColorState, workspacesProvider, 7),
		'fastSwitchProjects.action.colorPicker.removeColor': () => changeStatusbBarColor(statusBarColorState, workspacesProvider, 0),
		'fastSwitchProjects.action.colorPicker.hide': () => workspacesProvider.hideColorPicker(),
	});
	
}

//	Functions __________________________________________________________________

function changeStatusbBarColor (statusBarColorState: StatusBarColor, workspacesProvider: WorkspacesProvider, color: number) {
	
	statusBarColorState.assignProjectColor(workspacesProvider.colorPickerProject, color);
	workspacesProvider.colorPickerProject = null;
	
}

function addToWorkspace (project: Project) {
		
	const index: number = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length : 0;
	
	vscode.workspace.updateWorkspaceFolders(index, null, {
		name: project.label,
		uri: createUri(project.path),
	});
	
}

async function updateProjectsAndFavorites (statusBarColorState: StatusBarColor, favoritesState: FavoritesState, projectsState: ProjectsState) {
	
	if (!settings.isTrustedWorkspaceEnabled()) await statusBarColorState.detectProjectColors();
	else if (vscode.workspace.isTrusted) await statusBarColorState.detectCurrentProjectColor();
				
	if (settings.get('autoRemoveDeletedProjects')) {
		favoritesState.cleanupUnknownPaths();
		projectsState.removeDeletedProjects();
	} else {
		favoritesState.refreshFavoriteExists();
		projectsState.detectProjectsExists();
	}
	
}
