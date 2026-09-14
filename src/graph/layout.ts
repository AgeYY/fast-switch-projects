// Lane layout adapted from VS Code's toISCMHistoryItemViewModelArray (MIT).
// Copyright (c) Microsoft Corporation. All rights reserved. See LICENSE-VSCODE.txt.
// Changes: compact local model; preserve other lanes when a disconnected root ends;
// omit synthetic incoming/outgoing nodes and internal reference services.
import { Commit } from './git';

interface Lane {
	id: string; color: string
}
export interface GraphRow {
	historyItem: Commit;
	kind: 'HEAD' | 'node';
	base?: boolean;
	inputSwimlanes: Lane[];
	outputSwimlanes: Lane[];
}

export function layoutGraph (commits: Commit[], head: string, baseIds: string[] = []): GraphRow[] {

	const base = new Set(baseIds);
	const baseColor = 'fastSwitchProjects.baseBranch';
	let colorIndex = -1;
	let previous: Lane[] = [];
	return commits.map((historyItem) => {

		const inputSwimlanes = previous.map((lane) => ({ ...lane }));
		const outputSwimlanes: Lane[] = [];
		let firstParentAdded = false;
		for (const lane of inputSwimlanes) {
			if (lane.id === historyItem.id) {
				if (!firstParentAdded && historyItem.parentIds.length) {
					outputSwimlanes.push({ id: historyItem.parentIds[0], color: base.has(historyItem.id) ? baseColor : lane.color });
					firstParentAdded = true;
				}
			} else outputSwimlanes.push({ ...lane });
		}
		for (let i = firstParentAdded ? 1 : 0; i < historyItem.parentIds.length; i++) {
			colorIndex = (colorIndex + 1) % 5;
			const color = i === 0 && base.has(historyItem.id) ? baseColor : `scmGraph.foreground${colorIndex + 1}`;
			outputSwimlanes.push({ id: historyItem.parentIds[i], color });
		}
		previous = outputSwimlanes;
		return { historyItem, base: base.has(historyItem.id), kind: historyItem.id === head ? 'HEAD' : 'node', inputSwimlanes, outputSwimlanes };

	});

}
