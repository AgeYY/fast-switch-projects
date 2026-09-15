import { applyEdits, modify, parse, ParseError } from 'jsonc-parser';

export type WorkspaceFolderReference = { path: string }|{ uri: string };

export function validateProjectName (name: string) {

	return name.trim() ? null : 'Please enter a project name.';

}

export function setWorkspaceTitle (text: string, label: string) {

	readWorkspace(text);
	return edit(text, ['settings', 'window.title'], `\${dirty}\${activeEditorShort}\${separator}${label}\${separator}\${appName}`);

}

export function duplicateWorkspaceConfig (text: string, resolveFolder: (path: string) => WorkspaceFolderReference, label: string) {

	const workspace = readWorkspace(text);
	workspace.folders.forEach((folder: any, index: number) => {

		if (!folder || typeof folder !== 'object' || Array.isArray(folder)
			|| typeof folder.path !== 'string' && typeof folder.uri !== 'string'
			|| 'path' in folder && 'uri' in folder) {
			throw new Error('The workspace contains an invalid folder entry.');
		}
		if (typeof folder.path === 'string') {
			const reference = resolveFolder(folder.path);
			if ('uri' in reference) {
				text = edit(text, ['folders', index, 'path'], undefined);
				text = edit(text, ['folders', index, 'uri'], reference.uri);
			} else text = edit(text, ['folders', index, 'path'], reference.path);
		}

	});
	return setWorkspaceTitle(text, label);

}

function readWorkspace (text: string) {

	const errors: ParseError[] = [];
	const workspace: { folders: any[], settings?: Record<string, unknown> } = parse(text, errors, { allowTrailingComma: true });
	if (errors.length || !workspace || !Array.isArray(workspace.folders)) {
		throw new Error('The workspace file must contain valid JSON with a folders array (comments are allowed).');
	}
	if (workspace.settings !== undefined
		&& (!workspace.settings || typeof workspace.settings !== 'object' || Array.isArray(workspace.settings))) {
		throw new Error('The workspace settings must be a JSON object.');
	}
	return workspace;

}

function edit (text: string, path: Array<string|number>, value: unknown) {

	return applyEdits(text, modify(text, path, value, { formattingOptions: { insertSpaces: false, tabSize: 4 } }));

}
