//	Imports ____________________________________________________________________

import * as assert from 'assert';

import { openNewProjectsInNewWindows } from './newProjectWindows';

//	Variables __________________________________________________________________



//	Initialize _________________________________________________________________

describe('new project windows', () => {

	it('opens a newly added project in a new window', async () => {

		const opened: Array<{ path: string, openInNewWindow: boolean }> = [];

		await openNewProjectsInNewWindows([{ path: '/projects/one' }], true, (path, openInNewWindow) => {

			opened.push({ path, openInNewWindow });

		});

		assert.deepStrictEqual(opened, [{ path: '/projects/one', openInNewWindow: true }]);

	});

	it('opens every newly added project in its own new window', async () => {

		const opened: string[] = [];

		await openNewProjectsInNewWindows([
			{ path: '/projects/one' },
			{ path: '/projects/two' },
			{ path: '/projects/three' },
		], true, (path) => {

			opened.push(path);

		});

		assert.deepStrictEqual(opened, ['/projects/one', '/projects/two', '/projects/three']);

	});

	it('waits for project state to persist before opening the new window', async () => {

		const events: string[] = [];
		let finishPersistence: () => void;
		const persistence = new Promise<void>((resolve) => finishPersistence = resolve);
		const opening = openNewProjectsInNewWindows([{ path: '/projects/one' }], true, () => {

			events.push('open');

		}, async () => {

			events.push('persist');
			await persistence;

		});

		await Promise.resolve();
		assert.deepStrictEqual(events, ['persist']);

		finishPersistence();
		await opening;

		assert.deepStrictEqual(events, ['persist', 'open']);

	});

	it('does not open projects when automatic opening is disabled', async () => {

		let callCount = 0;

		await openNewProjectsInNewWindows([{ path: '/projects/one' }], false, () => {

			callCount++;

		});

		assert.strictEqual(callCount, 0);

	});

	it('does not open a window when no new project was created', async () => {

		let callCount = 0;

		await openNewProjectsInNewWindows(null, true, () => {

			callCount++;

		});

		assert.strictEqual(callCount, 0);

	});

});

//	Exports ____________________________________________________________________



//	Functions __________________________________________________________________
