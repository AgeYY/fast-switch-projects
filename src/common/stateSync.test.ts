//	Imports ____________________________________________________________________

import * as assert from 'assert';

import {
	CROSS_WINDOW_REFRESH_DELAYS,
	getNextLastModified,
	reloadSharedState,
	scheduleCrossWindowRefresh,
} from './stateSync';

//	Variables __________________________________________________________________



//	Initialize _________________________________________________________________

describe('stateSync', () => {

	it('reloads shared state and notifies the local view', () => {

		const expected = [{ index: 12, label: 'Project 12' }];
		let notified = null;

		const state = reloadSharedState(() => expected, (value) => notified = value);

		assert.strictEqual(state, expected);
		assert.strictEqual(notified, expected);

	});

	it('refreshes immediately and retries after each propagation delay', () => {

		let refreshCount = 0;
		const delays: number[] = [];
		const callbacks: Array<() => void> = [];

		const timeouts = scheduleCrossWindowRefresh(() => refreshCount++, (callback, delay) => {

			delays.push(delay);
			callbacks.push(callback);

			return <NodeJS.Timeout><unknown>{ delay };

		});

		assert.strictEqual(refreshCount, 1);
		assert.deepStrictEqual(delays, CROSS_WINDOW_REFRESH_DELAYS);
		assert.strictEqual(timeouts.length, CROSS_WINDOW_REFRESH_DELAYS.length);

		callbacks.forEach((callback) => callback());

		assert.strictEqual(refreshCount, 1 + CROSS_WINDOW_REFRESH_DELAYS.length);

	});

	it('creates a monotonic change marker for rapid updates', () => {

		assert.strictEqual(getNextLastModified(100, 99), 101);
		assert.strictEqual(getNextLastModified(100, 150), 150);

	});

});

//	Exports ____________________________________________________________________



//	Functions __________________________________________________________________
