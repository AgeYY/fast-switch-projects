//	Imports ____________________________________________________________________

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

//	Variables __________________________________________________________________

const projectsStateSource = readSource('states/ProjectsState.ts');
const projectsDialogSource = readSource('dialogs/ProjectsDialog.ts');
const dialogsSource = readSource('common/dialogs.ts');

//	Initialize _________________________________________________________________

describe('project add routing', () => {

	it('organizes single and multi-project additions directly in the project dialog', () => {

		const saveSource = getMethodSource(projectsDialogSource, 'save', 'rename');
		const addAllAndOpenSource = getMethodSource(projectsDialogSource, 'addAllAndOpen', 'organize');

		assert.ok(saveSource.includes('this.organize(this.projectsState.add(path, label))'));
		assert.ok(addAllAndOpenSource.includes('projects?.forEach((project) => this.organize(project))'));

	});

	it('returns before creating duplicate single or multi-project additions', () => {

		const addSource = getMethodSource(projectsStateSource, 'add', 'addAll');
		const addAllSource = getMethodSource(projectsStateSource, 'addAll', 'update');
		const addDuplicateGuard = addSource.indexOf('if (project.path === path) return');
		const addAllDuplicateGuard = addAllSource.indexOf('if (projects.some((project) => project.path === path)) return');

		assert.ok(addDuplicateGuard >= 0);
		assert.ok(addAllDuplicateGuard >= 0);
		assert.ok(addDuplicateGuard < addSource.indexOf('createProject'));
		assert.ok(addAllDuplicateGuard < addAllSource.indexOf('createProject'));

	});

	it('does not route imports, scans, or detected projects through add organization', () => {

		const importSource = readSource('commands/data.ts');
		const detectionSource = readSource('states/WorkspacesState.ts');

		assert.ok(!importSource.includes('organizeNewProject'));
		assert.ok(!detectionSource.includes('organizeNewProject'));
		assert.ok(!detectionSource.includes('projectsState.add'));

	});

	it('opens only projects selected by the explicit add commands', () => {

		const addDirectorySource = getMethodSource(projectsDialogSource, 'addDirectory', 'addWorkspaceFile');
		const addWorkspaceFileSource = getMethodSource(projectsDialogSource, 'addWorkspaceFile', 'save');
		const saveSource = getMethodSource(projectsDialogSource, 'save', 'rename');

		assert.ok(addDirectorySource.includes('addAllAndOpen'));
		assert.ok(addWorkspaceFileSource.includes('addAllAndOpen'));
		assert.ok(!saveSource.includes('addAllAndOpen'));
		assert.ok(!saveSource.includes('openNewProjectsInNewWindows'));

	});

	it('persists all add-event state before opening new project windows', () => {

		const addAllAndOpenSource = getMethodSource(projectsDialogSource, 'addAllAndOpen', null);
		const persistIndex = addAllAndOpenSource.indexOf('this.projectsState.persistPendingState()');
		const openIndex = addAllAndOpenSource.indexOf('openNewProjectsInNewWindows');

		assert.ok(persistIndex >= 0);
		assert.ok(openIndex >= 0);

	});

	it('starts project pickers outside the current workspace directory', () => {

		assert.ok(dialogsSource.includes('const defaultUri = getProjectPickerDefaultUri()'));
		assert.ok(dialogsSource.includes('defaultUri: getProjectPickerDefaultUri()'));
		assert.ok(dialogsSource.includes('<vscode.Uri>dirname(uri)'));

	});

});

//	Exports ____________________________________________________________________



//	Functions __________________________________________________________________

function readSource (relativePath: string) {

	return fs.readFileSync(path.resolve(process.cwd(), 'src', relativePath), 'utf8');

}

function getMethodSource (source: string, methodName: string, nextMethodName: string|null) {

	const start = findMethodStart(source, methodName);
	const end = nextMethodName ? findMethodStart(source, nextMethodName, start) : source.length;

	assert.ok(start >= 0, `Method ${methodName} was not found`);
	assert.ok(end > start, `Method ${nextMethodName} was not found after ${methodName}`);

	return source.slice(start, end);

}

function findMethodStart (source: string, methodName: string, fromIndex = 0) {

	const indexes = [
		source.indexOf(`public ${methodName} (`, fromIndex),
		source.indexOf(`public async ${methodName} (`, fromIndex),
		source.indexOf(`private ${methodName} (`, fromIndex),
		source.indexOf(`private async ${methodName} (`, fromIndex),
	].filter((index) => index >= 0);

	return indexes.length ? Math.min(...indexes) : -1;

}
