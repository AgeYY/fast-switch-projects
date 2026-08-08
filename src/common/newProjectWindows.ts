//	Imports ____________________________________________________________________



//	Variables __________________________________________________________________



//	Initialize _________________________________________________________________



//	Exports ____________________________________________________________________

export type OpenProject = (path: string, openInNewWindow: boolean) => unknown;

export async function openNewProjectsInNewWindows (projects: ReadonlyArray<{ path: string }>, enabled: boolean, open: OpenProject) {

	if (!enabled || !projects?.length) return;

	await Promise.all(projects.map((project) => open(project.path, true)));

}

//	Functions __________________________________________________________________
