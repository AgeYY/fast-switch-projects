//	Imports ____________________________________________________________________

import * as vscode from 'vscode';

import { isMacOs } from '../@l13/platforms';

import { dirname } from './uris';
import { getCurrentWorkspaceUri, isRemoteWorkspace } from './workspaces';

//	Variables __________________________________________________________________



//	Initialize _________________________________________________________________



//	Exports ____________________________________________________________________

export async function openWorkspaceFolder () {

	const defaultUri = getProjectPickerDefaultUri();
	
	return await vscode.window.showOpenDialog(isMacOs && !isRemoteWorkspace() ? {
		canSelectFiles: true,
		canSelectFolders: true,
		canSelectMany: true,
		defaultUri,
		filters: {
			Workspaces: ['code-workspace'],
		},
	} : {
		canSelectFiles: false,
		canSelectFolders: true,
		canSelectMany: true,
		defaultUri,
	}) || null;
	
}

export async function openWorkspaceFile () {
	
	if (isRemoteWorkspace()) {
		vscode.window.showInformationMessage('Remote workspace files are not supported by Visual Studio Code');
		return null;
	}
	
	return await vscode.window.showOpenDialog({
		canSelectFiles: true,
		canSelectFolders: false,
		canSelectMany: true,
		defaultUri: getProjectPickerDefaultUri(),
		filters: {
			Workspaces: ['code-workspace'],
		},
	}) || null;
	
}

export function getProjectPickerDefaultUri () {

	const uri = getCurrentWorkspaceUri();

	return uri && uri.scheme !== 'untitled' ? <vscode.Uri>dirname(uri) : undefined;

}
	
export async function confirm (text: string, ...buttons: string[]) {
	
	return await vscode.window.showInformationMessage(text, { modal: true }, ...buttons);
	
}

//	Functions __________________________________________________________________
