//	Imports ____________________________________________________________________



//	Variables __________________________________________________________________

export const CROSS_WINDOW_REFRESH_DELAYS = [100, 500, 1000];

type Schedule = (callback: () => void, delay: number) => NodeJS.Timeout;

//	Initialize _________________________________________________________________



//	Exports ____________________________________________________________________

export function reloadSharedState<T> (load: () => T, notify: (state: T) => void) {

	const state = load();

	notify(state);

	return state;

}

export function scheduleCrossWindowRefresh (refresh: () => void, schedule: Schedule = setTimeout) {

	refresh();

	return CROSS_WINDOW_REFRESH_DELAYS.map((delay) => schedule(refresh, delay));

}

export function getNextLastModified (previousLastModified: number, currentTime = +new Date()) {

	return Math.max(currentTime, previousLastModified + 1);

}

//	Functions __________________________________________________________________
