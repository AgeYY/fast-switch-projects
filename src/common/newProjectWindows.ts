//	Imports ____________________________________________________________________



//	Variables __________________________________________________________________



//	Initialize _________________________________________________________________



//	Exports ____________________________________________________________________

export type OpenProject = (path: string, openInNewWindow: boolean) => unknown;
export type BeforeOpen = () => PromiseLike<void>|void;

export async function openNewProjectsInNewWindows (projects: ReadonlyArray<{ path: string }>, enabled: boolean, open: OpenProject, beforeOpen?: BeforeOpen) {

	if (!enabled || !projects?.length) return;

	await beforeOpen?.();

	await Promise.all(projects.map((project) => open(project.path, true)));

}

//	Functions __________________________________________________________________
