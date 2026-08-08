//	Imports ____________________________________________________________________

import * as vscode from 'vscode';

import { formatLabel } from '../@l13/formats';
import { isMacOs, isWindows } from '../@l13/platforms';

import * as settings from '../common/settings';
import * as states from '../common/states';
import { createUri } from '../common/uris';
import { getCurrentWorkspacePath, isCodeWorkspace, isRemoteWorkspace } from '../common/workspaces';

//	Variables __________________________________________________________________

let revealFolderInOS = 'fastSwitchProjects.action.workspace.openContainingFolder';

const commands = {
	favorites: 'fastSwitchProjects.action.favorites.pickFavorite',
	workspaces: 'fastSwitchProjects.action.workspaces.pickWorkspace',
	tags: 'fastSwitchProjects.action.tag.pickTag',
};

//	Initialize _________________________________________________________________

if (isMacOs) revealFolderInOS = 'fastSwitchProjects.action.workspace.revealInFinder';
else if (isWindows) revealFolderInOS = 'fastSwitchProjects.action.workspace.revealInExplorer';

//	Exports ____________________________________________________________________

export class StatusBarInfo implements vscode.Disposable {
	
	private readonly statusBarItem: vscode.StatusBarItem;
	
	private static current: StatusBarInfo;
	
	public static create (context: vscode.ExtensionContext) {
		
		return StatusBarInfo.current || (StatusBarInfo.current = new StatusBarInfo(context));
		
	}
	
	private constructor (private context: vscode.ExtensionContext) {
		
		this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
		
		if (!isRemoteWorkspace()) this.statusBarItem.command = getStatusbarCommand();
		
		this.refresh();
		this.statusBarItem.show();
		
		context.subscriptions.push(this);
		
		context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
			
			if (event.affectsConfiguration('fastSwitchProjects.statusBarAction') && !isRemoteWorkspace()) {
				this.statusBarItem.command = getStatusbarCommand();
			}
			
		}));
		
	}
	
	public refresh () {
		
		const currentWorkspacePath = getCurrentWorkspacePath();
		
		if (currentWorkspacePath) {
			const fsPath = createUri(currentWorkspacePath).path;
			const icon = isCodeWorkspace(fsPath) ? 'submodule' : 'directory';
			const name = this.getWorkspaceName(currentWorkspacePath);
			
			this.statusBarItem.text = `$(file-${icon}) ${name || formatLabel(fsPath)}`;
			this.statusBarItem.tooltip = currentWorkspacePath;
		}
		
	}
	
	private getWorkspaceName (workspacePath: string) {
		
		const projects = states.getProjects(this.context);
		
		for (const project of projects) {
			if (project.path === workspacePath) return project.label;
		}
		
		return '';
		
	}
	
	public dispose () {
		
		this.statusBarItem.dispose();
		StatusBarInfo.current = undefined;
		
	}
	
}

//	Functions __________________________________________________________________

function getStatusbarCommand () {
	
	return commands[settings.get<keyof typeof commands>('statusBarAction')] || revealFolderInOS;
	
}