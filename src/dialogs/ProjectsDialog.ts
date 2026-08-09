//	Imports ____________________________________________________________________

import * as vscode from 'vscode';

import { formatLabel } from '../@l13/formats';

import type { Project } from '../@types/workspaces';

import * as dialogs from '../common/dialogs';
import * as files from '../common/files';
import { openNewProjectsInNewWindows } from '../common/newProjectWindows';
import { organizeNewProject } from '../common/projectOrganizer';
import * as settings from '../common/settings';
import { getCurrentWorkspacePath } from '../common/workspaces';

import type { HotkeySlotsState } from '../states/HotkeySlotsState';
import type { ProjectsState } from '../states/ProjectsState';
import type { WorkspaceGroupsState } from '../states/WorkspaceGroupsState';

//	Variables __________________________________________________________________



//	Initialize _________________________________________________________________



//	Exports ____________________________________________________________________

export class ProjectsDialog {
	
	private static current: ProjectsDialog = null;
	
	public static create (projectsState: ProjectsState, hotkeySlotsState: HotkeySlotsState, workspaceGroupsState: WorkspaceGroupsState) {
		
		return ProjectsDialog.current || (ProjectsDialog.current = new ProjectsDialog(projectsState, hotkeySlotsState, workspaceGroupsState));
		
	}
	
	private constructor (private readonly projectsState: ProjectsState, private readonly hotkeySlotsState: HotkeySlotsState,
		private readonly workspaceGroupsState: WorkspaceGroupsState) {}
	
	public async addDirectory () {
		
		const uris = await dialogs.openWorkspaceFolder();
		
		if (!uris) return;
		
		await this.addAllAndOpen(uris);
		
	}
	
	public async addWorkspaceFile () {
		
		const uris = await dialogs.openWorkspaceFile();
		
		if (!uris) return;
		
		await this.addAllAndOpen(uris);
		
	}
	
	public async save (project?: Project) {
		
		const path: string = project ? project.path : getCurrentWorkspacePath();
		
		if (path) {
			const existingProject = this.projectsState.getByPath(path);
			
			if (existingProject) {
				vscode.window.showInformationMessage(`Project "${existingProject.label}" exists!`);
				return;
			}
			
			const label = await vscode.window.showInputBox({
				value: formatLabel(path),
				placeHolder: 'Please enter a name for the project',
			});
			
			if (!label) return;
			
			this.organize(this.projectsState.add(path, label));
		} else if (vscode.workspace.workspaceFile?.scheme === 'untitled') {
			vscode.window.showWarningMessage('Please save your current workspace first.');
			vscode.commands.executeCommand('workbench.action.saveWorkspaceAs');
		} else vscode.window.showErrorMessage('No folder or workspace available!');
		
	}
	
	public async rename (project: Project) {
		
		const label = await vscode.window.showInputBox({
			value: project.label,
			placeHolder: 'Please enter a new name for the project',
		});
		
		if (project.label === label || label === undefined) return;
		
		if (!label) {
			vscode.window.showErrorMessage('Project with no name is not valid!');
			return;
		}
		
		this.projectsState.rename(project, label);
		
	}
	
	public async remove (project: Project) {
		
		if (settings.get('confirmDeleteProject', true)) {
			const buttonDeleteDontShowAgain = 'Delete, don\'t show again';
			const value = await dialogs.confirm(`Delete project "${project.label}"?`, 'Delete', buttonDeleteDontShowAgain);
			if (!value) return;
			if (value === buttonDeleteDontShowAgain) settings.update('confirmDeleteProject', false);
		}
		
		this.projectsState.remove(project);
		
	}
	
	public async clear () {
		
		if (await dialogs.confirm('Delete all projects?', 'Delete')) {
			this.projectsState.clear();
		}
		
	}

	private async addAllAndOpen (uris: vscode.Uri[]) {

		const projects = this.projectsState.addAll(uris);
		projects?.forEach((project) => this.organize(project));

		try {
			await openNewProjectsInNewWindows(projects, settings.openNewProjectsInNewWindow(), files.open, () => this.projectsState.persistPendingState());
		} catch (error) {
			vscode.window.showErrorMessage('One or more newly added projects could not be opened in a new window.');
		}

	}

	private organize (project: Project) {

		if (!project) return;

		organizeNewProject(project, {
			hotkeySlots: this.hotkeySlotsState,
			workspaceGroups: this.workspaceGroupsState,
		});

	}
	
}

//	Functions __________________________________________________________________
