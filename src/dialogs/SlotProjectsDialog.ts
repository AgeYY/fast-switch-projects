import * as vscode from 'vscode';

import type { Project } from '../@types/workspaces';
import * as files from '../common/files';
import { ManagedWorkspaces } from '../common/managedWorkspaces';
import { organizeNewProject } from '../common/projectOrganizer';
import { validateProjectName } from '../common/workspaceConfig';
import { createWorkspaceItem } from '../common/workspaces';
import type { SlotTreeItem } from '../sidebar/trees/items/SlotTreeItem';
import type { HotkeySlotsState } from '../states/HotkeySlotsState';
import type { ProjectsState } from '../states/ProjectsState';

export class SlotProjectsDialog {

	private readonly workspaces: ManagedWorkspaces;

	public constructor (storageUri: vscode.Uri, private readonly projects: ProjectsState, private readonly slots: HotkeySlotsState) {

		this.workspaces = new ManagedWorkspaces(storageUri);

	}

	public async duplicate (item?: SlotTreeItem) {

		const project = await this.selectProject('Select the project to duplicate', item);
		if (!project) return;
		const label = await this.askName('Duplicate Project', `${project.label} — copy`, 'The new window will share the same files and Git branch.');
		if (!label) return;

		let duplicate: Project;
		try {
			const workspacePath = await this.workspaces.duplicate(project.path, label);
			this.slots.refresh();
			duplicate = this.projects.add(workspacePath, label);
			organizeNewProject(duplicate, { hotkeySlots: this.slots });
			await this.projects.persistPendingState();
		} catch (error) {
			vscode.window.showErrorMessage(`Could not duplicate project: ${error.message}`);
			return;
		}

		try {
			await files.open(duplicate.path, true);
		} catch (error) {
			vscode.window.showErrorMessage(`Project "${label}" was saved, but its window could not be opened. Try opening its slot again.`);
		}

	}

	public async rename (item?: SlotTreeItem) {

		const project = await this.selectProject('Select the project to rename', item);
		if (!project) return;
		const label = await this.askName('Rename Project', project.label, 'Change the project name shown in Slots.');
		if (!label || label === project.label) return;

		try {
			await this.workspaces.rename(project.path, label);
			this.slots.refresh();
			if (this.projects.getByPath(project.path)) this.projects.rename(project, label);
			else this.projects.add(project.path, label);
			await this.projects.persistPendingState();
		} catch (error) {
			vscode.window.showErrorMessage(`Could not rename project: ${error.message}`);
		}

	}

	private async selectProject (title: string, item?: SlotTreeItem) {

		this.slots.refresh();
		let selectedPath = item?.slot?.path;
		if (item && !selectedPath) return;
		if (!item) {
			const choices = this.slots.get().filter((slot) => slot?.path).map((slot) => ({
				label: slot.label,
				description: `Slot ${slot.index}`,
				detail: slot.path,
				path: slot.path,
			}));
			if (!choices.length) {
				vscode.window.showInformationMessage('Add a project to Slots first.');
				return;
			}
			selectedPath = (await vscode.window.showQuickPick(choices, { title }))?.path;
		}
		if (!selectedPath) return;
		const selectedSlot = this.slots.get().find((candidate) => candidate?.path === selectedPath);
		if (!selectedSlot) return;
		return this.projects.getByPath(selectedPath) || createWorkspaceItem(selectedPath, undefined, selectedSlot.label);

	}

	private async askName (title: string, value: string, prompt: string) {

		const name = await vscode.window.showInputBox({ title, value, prompt, validateInput: validateProjectName });
		return name?.trim();

	}

}
