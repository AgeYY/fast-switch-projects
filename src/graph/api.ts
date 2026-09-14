// Minimal structural subset of the built-in vscode.git API, version 1.
import * as vscode from 'vscode';

export interface Repository {
	rootUri: vscode.Uri;
	fetch(): Promise<void>;
	pull(): Promise<void>;
	push(): Promise<void>;
	state: {
		HEAD?: { name?: string; ahead?: number; behind?: number };
		onDidChange: vscode.Event<void>;
	};
}

export interface GitAPI {
	git: { path: string };
	repositories: Repository[];
	onDidOpenRepository: vscode.Event<Repository>;
	onDidCloseRepository: vscode.Event<Repository>;
	getRepository(uri: vscode.Uri): Repository | null;
	toGitUri(uri: vscode.Uri, ref: string): vscode.Uri;
}

export interface GitExtension {
	enabled: boolean;
	onDidChangeEnablement: vscode.Event<boolean>;
	getAPI(version: number): GitAPI;
}
