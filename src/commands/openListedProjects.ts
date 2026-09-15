import * as vscode from 'vscode';

import { collectListedProjects } from '../common/listedProjects';
import { createUri } from '../common/uris';
import { getCurrentWorkspacePath } from '../common/workspaces';

import type { HotkeySlotsState } from '../states/HotkeySlotsState';
import type { TagsState } from '../states/TagsState';

let opening = false;

export async function openListedProjects (slots: HotkeySlotsState, tags: TagsState, register = false) {

	if (opening) {
		vscode.window.showInformationMessage('Open All Listed Projects is already running.');
		return;
	}
	opening = true;
	const title = register ? 'Open and Register All Listed Projects' : 'Open All Listed Projects';
	try {
		slots.refresh();
		const paths = collectListedProjects(slots.get(), (id) => tags.getById(id)?.paths);
		const projects = new Map(paths.map((path) => [identity(createUri(path)), createUri(path)]));
		if (!projects.size) {
			vscode.window.showInformationMessage('No projects are listed in Slots. Add a project to the sidebar first.');
			return;
		}
		const available = await vscode.commands.getCommands(true);
		const prepare = 'fastSwitchProjects.windows.prepareRegistration';
		const statusCommand = 'fastSwitchProjects.windows.registrationStatus';
		let approved: string[] = [];
		if (register) {
			if (!available.includes(prepare) || !available.includes(statusCommand)) {
				throw new Error('Install Windows Companion 0.1.2 or newer locally and reload this window to register listed projects');
			}
			const result = await vscode.commands.executeCommand<{ ok: boolean, keys: string[] }>(prepare,
				[...projects.values()].map((uri) => uri.toString()));
			if (!result?.ok) throw new Error('The Windows companion did not approve project registration');
			approved = result.keys;
		}
		// Bulk opening is explicit: reveal managed windows and pause hiding first.
		const recovery = 'fastSwitchProjects.windows.showAll';
		if (!register && available.includes(recovery)) await vscode.commands.executeCommand(recovery);
		const current = getCurrentWorkspacePath();
		if (current) projects.delete(identity(createUri(current)));
		return await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title,
			cancellable: true,
		}, async (progress, token) => {

			let opened = 0;
			const failed: string[] = [];
			for (const uri of projects.values()) {
				if (token.isCancellationRequested) break;
				progress.report({ message: `${opened + failed.length + 1}/${projects.size}: ${uri.path}` });
				try {
					// Bypass single-window switching and never replace the invoking window.
					await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: true });
					opened++;
				} catch (error) {
					failed.push(`${uri.path}: ${error instanceof Error ? error.message : error}`);
				}
			}
			let pending = approved.slice();
			if (register) {
				const deadline = Date.now() + 60000;
				do {
					const status = await vscode.commands.executeCommand<{ keys: string[] }>(statusCommand);
					if (!status || !Array.isArray(status.keys)) throw new Error('Cannot check project window registration');
					pending = approved.filter((key) => !status.keys.includes(key));
					progress.report({ message: `Registered ${approved.length - pending.length}/${approved.length} project windows` });
					if (!pending.length || token.isCancellationRequested) break;
					await new Promise((resolve) => setTimeout(resolve, 500));
				} while (Date.now() < deadline);
			}
			let summary = `${token.isCancellationRequested ? 'Stopped' : 'Finished'}: requested ${opened} project window(s).`;
			if (register) {
				summary += ` Registered ${approved.length - pending.length}/${approved.length}.`;
				if (pending.length) summary += ` Waiting for startup or workspace trust: ${pending.join(', ')}.`;
				else summary += ' Run Enable Single Visible Window Mode in your desired active project window.';
			}
			if (failed.length) vscode.window.showWarningMessage(`${summary} Could not open: ${failed.join('; ')}`);
			else vscode.window.showInformationMessage(summary);
			return { opened, failed, cancelled: token.isCancellationRequested, registered: approved.length - pending.length, pending };

		});
	} catch (error) {
		vscode.window.showErrorMessage(`Could not open listed projects: ${error instanceof Error ? error.message : error}`);
	} finally {
		opening = false;
	}

}

function identity (uri: vscode.Uri) {

	const value = uri.toString();
	return process.platform === 'win32' && uri.scheme === 'file' ? value.toLowerCase() : value;

}
