import * as vscode from 'vscode';

// Commands cross the Remote-SSH boundary; exported extension APIs do not.
export async function openInSingleWindow (uri: vscode.Uri) {

	const command = 'fastSwitchProjects.windows.open';
	const available = await vscode.commands.getCommands(true);
	if (!available.includes(command)) return false;
	try {
		return await vscode.commands.executeCommand<boolean>(command, uri.toString());
	} catch (error) {
		vscode.window.showWarningMessage(`Single window companion unavailable: ${error instanceof Error ? error.message : error}`);
		await vscode.commands.executeCommand('vscode.openFolder', uri, true);
		return true;
	}

}
