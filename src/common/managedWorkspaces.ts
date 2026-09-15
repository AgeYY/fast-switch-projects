import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import { createUri, getPath } from './uris';
import { duplicateWorkspaceConfig, setWorkspaceTitle, WorkspaceFolderReference } from './workspaceConfig';

// Files live in the extension host's storage, including when running over SSH.
// IDs stay fixed across renames so VS Code retains the workspace's UI state.
export class ManagedWorkspaces {

	private readonly directory: vscode.Uri;

	public constructor (storageUri: vscode.Uri) {

		// Desktop VS Code can expose its on-disk user storage with this scheme.
		const hostStorage = storageUri.scheme === 'vscode-userdata' ? vscode.Uri.file(storageUri.fsPath) : storageUri;
		this.directory = vscode.Uri.joinPath(hostStorage, 'project-workspaces');

	}

	public async duplicate (sourcePath: string, label: string) {

		const source = createUri(sourcePath);
		const stat = await vscode.workspace.fs.stat(source);
		let text: string;
		if (stat.type === vscode.FileType.Directory || stat.type === vscode.FileType.Directory + vscode.FileType.SymbolicLink) {
			text = setWorkspaceTitle(JSON.stringify({ folders: [folderReference(source)] }, null, '\t'), label);
		} else {
			if (!source.path.endsWith('.code-workspace')) throw new Error('Select a folder or a .code-workspace file.');
			const original = Buffer.from(await vscode.workspace.fs.readFile(source)).toString('utf8');
			text = duplicateWorkspaceConfig(original, (folderPath) => resolveWorkspaceFolder(source, folderPath), label);
		}

		// Exclusive creation prevents replacing any existing workspace, even on a name collision.
		if (this.directory.scheme !== 'file') throw new Error('Project duplication requires storage on the extension host.');
		await fs.mkdir(this.directory.fsPath, { recursive: true });
		const container = vscode.Uri.joinPath(this.directory, randomBytes(16).toString('hex'));
		await fs.mkdir(container.fsPath);
		// Keep the opaque identity out of the Explorer's workspace heading.
		const destination = vscode.Uri.joinPath(container, 'Project.code-workspace');
		await fs.writeFile(destination.fsPath, text, { flag: 'wx' });
		return getPath(destination);

	}

	public async rename (workspacePath: string, label: string) {

		const uri = createUri(workspacePath);
		if (!this.owns(workspacePath)) return;
		const original = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
		await vscode.workspace.fs.writeFile(uri, Buffer.from(setWorkspaceTitle(original, label)));

	}

	public owns (workspacePath: string) {

		const uri = createUri(workspacePath);

		const container = path.posix.dirname(uri.path);
		return uri.scheme === this.directory.scheme && uri.authority === this.directory.authority
			&& path.posix.dirname(container) === this.directory.path
			&& /^[a-f0-9]{32}$/.test(path.posix.basename(container))
			&& path.posix.basename(uri.path) === 'Project.code-workspace';

	}

}

function folderReference (uri: vscode.Uri): WorkspaceFolderReference {

	return uri.scheme === 'file' ? { path: uri.fsPath } : { uri: uri.toString() };

}

export function resolveWorkspaceFolder (workspaceFile: vscode.Uri, folderPath: string): WorkspaceFolderReference {

	if (workspaceFile.scheme === 'file') {
		return { path: path.resolve(path.dirname(workspaceFile.fsPath), folderPath) };
	}
	return { uri: workspaceFile.with({ path: path.posix.resolve(path.posix.dirname(workspaceFile.path), folderPath) }).toString() };

}
