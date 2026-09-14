import { randomBytes } from 'crypto';
import { basename } from 'path';
import * as vscode from 'vscode';
import { GitAPI, GitExtension, Repository } from './api';
import { Commit, FileChange, GitReader } from './git';
import { layoutGraph } from './layout';
import { simplifyHistory } from './simplify';
import { applyImportance, branchKey, BranchFilter, Importance } from './importance';
import { ImportanceStore } from './ImportanceStore';

export class GraphProvider implements vscode.WebviewViewProvider, vscode.Disposable {

	private view?: vscode.WebviewView;
	private api?: GitAPI;
	private repository?: Repository;
	private readonly subscriptions: vscode.Disposable[] = [];
	private readonly repositorySubscriptions = new Map<Repository, vscode.Disposable>();
	private commits = new Map<string, Commit>();
	private details?: { repository: Repository; commit: Commit; changes: FileChange[] };
	private revision = 0;
	private detailRevision = 0;
	private limit = 200;
	private timer?: NodeJS.Timeout;
	private disposed = false;
	private initializing?: Promise<void>;
	private gitEnablementSubscription?: vscode.Disposable;
	private readonly apiSubscriptions: vscode.Disposable[] = [];
	private operationRunning = false;
	private referenceTimer?: NodeJS.Timeout;
	private checkingReferences = false;
	private referenceRepository?: Repository;
	private referenceSnapshot?: string;
	private lastHistory?: string;
	private readonly importanceStores = new Map<Repository, Promise<ImportanceStore>>();

	constructor (private readonly context: vscode.ExtensionContext) {

		this.referenceTimer = setInterval(() => {

			void this.checkReferences();

		}, 2000);

		this.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => {

			if (!this.context.workspaceState.get<string>('graph.repository')) this.schedule();

		}));
		this.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {

			if (event.affectsConfiguration('fastSwitchProjects.graph')) {
				this.limit = this.pageSize(); this.schedule();
			}

		}));
		this.subscriptions.push(vscode.workspace.onDidGrantWorkspaceTrust(() => this.schedule()));
		this.subscriptions.push(vscode.window.onDidChangeWindowState((state) => {

			if (state.focused) this.schedule();

		}));

	}

	resolveWebviewView (view: vscode.WebviewView): void {

		this.view = view;
		const webview = view.webview;
		const root = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'graph');
		webview.options = { enableScripts: true, localResourceRoots: [root] };
		const nonce = randomBytes(16).toString('hex');
		function asset (name: string) {

			return webview.asWebviewUri(vscode.Uri.joinPath(root, name));

		}
		webview.html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<link rel="stylesheet" href="${asset('graph.css')}"></head><body>
<div class="toolbar"><select id="repository" aria-label="Repository"><option>Auto</option></select>
<button id="scope" title="Toggle current branch and all branches" aria-pressed="true">All branches</button>
<button id="refresh" title="Refresh graph" aria-label="Refresh graph">↻</button></div>
<div id="branch"></div><div class="graph-options">
<button id="mode" aria-pressed="true" title="Switch between simple graph and full commit history">Simple</button>
<select id="importance-filter" aria-label="Branch visibility">
<option value="all">All priorities</option><option value="active">Hide archived</option>
<option value="important">Important only</option></select>
<button id="base" hidden title="Choose the branch to highlight">Base: Auto</button></div>
<div id="summary"></div><div id="status" role="status">Loading graph…</div>
<div id="history" role="list" aria-label="Commit history"></div>
<button id="more" hidden>Load more commits</button>
<section id="details" hidden aria-label="Commit details"><div class="detail-header"><strong id="hash"></strong>
<button id="copy" title="Copy commit hash">Copy</button><button id="close" aria-label="Close commit details">×</button></div>
<div id="author"></div><pre id="message"></pre><div id="comparison"></div><div id="files"></div></section>
<script nonce="${nonce}" src="${asset('scmGraph.js')}"></script>
<script nonce="${nonce}" src="${asset('graph.js')}"></script></body></html>`;
		view.onDidDispose(() => {

			if (this.view === view) this.view = undefined;

		}, null, this.subscriptions);
		view.onDidChangeVisibility(() => {

			if (view.visible) this.schedule();

		}, null, this.subscriptions);
		webview.onDidReceiveMessage((message: unknown) => {

			void this.receive(message).catch((error) => vscode.window.showErrorMessage(`Graph: ${String(error.message || error)}`));

		}, null, this.subscriptions);

	}

	private pageSize (): number {

		return Math.max(25, Math.min(1000, Number(vscode.workspace.getConfiguration('fastSwitchProjects.graph').get('pageSize', 200)) || 200));

	}

	private allBranches (): boolean {

		return this.context.workspaceState.get('graph.allBranches', true);

	}

	private async initialize (): Promise<void> {

		if (this.initializing) return this.initializing;
		this.initializing = (async () => {

			const extension = vscode.extensions.getExtension<GitExtension>('vscode.git');
			if (!extension) throw new Error('Enable the built-in Git extension in this workspace to use Graph.');
			const git = await extension.activate();
			if (this.disposed) return;
			if (!this.gitEnablementSubscription) {
				this.gitEnablementSubscription = git.onDidChangeEnablement(() => {

					this.apiSubscriptions.splice(0).forEach((subscription) => subscription.dispose());
					this.repositorySubscriptions.forEach((subscription) => subscription.dispose());
					this.repositorySubscriptions.clear();
					this.api = undefined;
					this.initializing = undefined;
					this.schedule();

				});
			}
			if (!git.enabled) throw new Error('Enable Git in this workspace to use Graph.');
			this.api = git.getAPI(1);
			const watch = (repository: Repository) => {

				if (!this.repositorySubscriptions.has(repository)) {
					this.repositorySubscriptions.set(repository, repository.state.onDidChange(() => this.schedule()));
				}

			};
			this.api.repositories.forEach(watch);
			this.apiSubscriptions.push(this.api.onDidOpenRepository((repository) => {

				watch(repository); this.schedule();

			}));
			this.apiSubscriptions.push(this.api.onDidCloseRepository((repository) => {

				this.repositorySubscriptions.get(repository)?.dispose();
				this.repositorySubscriptions.delete(repository);
				this.schedule();

			}));

		})();
		try {
			await this.initializing;
		} catch (error) {
			this.initializing = undefined; throw error;
		}

	}

	private importanceStore (repository: Repository): Promise<ImportanceStore> {

		if (!this.importanceStores.has(repository)) {
			const reader = new GitReader(this.api.git.path, repository.rootUri.fsPath);
			this.importanceStores.set(repository, reader.commonDirectory().then((directory) => new ImportanceStore(directory))
				.catch((error) => {

					this.importanceStores.delete(repository); throw error;

				}));
		}
		return this.importanceStores.get(repository);

	}

	private async checkReferences (): Promise<void> {

		const repository = this.repository;
		if (this.disposed || !this.view?.visible || !repository || !this.api
			|| !vscode.workspace.isTrusted || this.checkingReferences) return;
		this.checkingReferences = true;
		try {
			const refs = await new GitReader(this.api.git.path, repository.rootUri.fsPath).referenceState();
			const priorities = await (await this.importanceStore(repository)).read();
			const snapshot = refs + JSON.stringify(Array.from(priorities));
			if (this.disposed || repository !== this.repository) return;
			if (repository !== this.referenceRepository || snapshot !== this.referenceSnapshot) {
				this.referenceRepository = repository;
				this.referenceSnapshot = snapshot;
				this.schedule();
			}
		} catch { /* A closed or temporarily unavailable repository is handled by refresh. */ } finally {
			this.checkingReferences = false;
		}

	}

	private schedule (): void {

		this.revision++;
		if (this.timer) clearTimeout(this.timer);
		if (this.view?.visible && !this.disposed) {
			this.timer = setTimeout(() => {

				void this.refresh();

			}, 250);
		}

	}

	async refresh (): Promise<void> {

		const revision = ++this.revision;
		if (!this.view || this.disposed) return;
		this.post({ type: 'loading' });
		try {
			if (!vscode.workspace.isTrusted) throw new Error('Trust this workspace to load Git history.');
			await this.initialize();
			if (!this.api) throw new Error('Git is disabled in this workspace.');
			if (revision !== this.revision || this.disposed) return;
			const pinned = this.context.workspaceState.get<string>('graph.repository');
			const active = vscode.window.activeTextEditor?.document.uri;
			const repository = this.api.repositories.find((repo) => repo.rootUri.toString() === pinned)
				|| active && this.api.getRepository(active) || this.api.repositories[0];
			if (repository !== this.repository) {
				this.limit = this.pageSize();
				this.details = undefined;
				this.detailRevision++;
			}
			this.repository = repository;
			void vscode.commands.executeCommand('setContext', 'fastSwitchProjects.graph.hasRepository', !!repository);
			const baseOverride = repository ? this.context.workspaceState.get<string>(`graph.base.${repository.rootUri.toString()}`, '') : '';
			const history = repository ? await new GitReader(this.api.git.path, repository.rootUri.fsPath)
				.history(this.limit, this.allBranches(), baseOverride) : { commits: [], head: '', hasMore: false };
			if (revision !== this.revision || this.disposed) return;
			const simple = this.context.workspaceState.get('graph.simple', true);
			const priorities = repository ? await (await this.importanceStore(repository)).read() : new Map<string, Importance>();
			if (revision !== this.revision || this.disposed) return;
			const filter = this.context.workspaceState.get<BranchFilter>('graph.importanceFilter', 'all');
			const baseKey = history.base ? branchKey({ name: history.base.name,
				kind: history.base.ref.startsWith('refs/remotes/') ? 'remote' : 'local' }) : '';
			const visible = applyImportance(history.commits, priorities, filter, history.head, history.base?.id,
				repository?.state.HEAD?.name, baseKey);
			const simplified = simple ? simplifyHistory(visible, history.head) : undefined;
			const rows = layoutGraph(simplified?.commits || visible, history.head, history.baseIds)
				.map((row) => ({ ...row, summary: simplified?.labels.get(row.historyItem.id) }));
			const update = { type: 'history', rows, simple, importanceFilter: filter,
				baseImportance: priorities.get(baseKey) || 'normal',
				hiddenCount: simplified?.hiddenCount || 0,
				repositories: this.api.repositories.map((repo) => ({
					id: repo.rootUri.toString(), name: basename(repo.rootUri.fsPath), path: repo.rootUri.fsPath,
				})),
				repositoryId: repository?.rootUri.toString() || '',
				selected: pinned || '', repository: repository ? basename(repository.rootUri.fsPath) : '',
				base: history.base, hasRepository: !!repository,
				baseOverride,
				branch: repository?.state.HEAD?.name || (history.head ? 'Detached HEAD' : ''),
				ahead: repository?.state.HEAD?.ahead || 0, behind: repository?.state.HEAD?.behind || 0,
				allBranches: this.allBranches(), hasMore: history.hasMore && this.limit < 5000,
				emptyMessage: repository ? 'No commits yet.' : 'Open a folder containing a Git repository.' };
			const snapshot = JSON.stringify(update);
			if (snapshot === this.lastHistory) {
				this.post({ type: 'settled' });
				return;
			}
			this.lastHistory = snapshot;
			this.commits = new Map(history.commits.map((commit) => [commit.id, commit]));
			if (this.details && (this.details.repository !== repository || !this.commits.has(this.details.commit.id))) {
				this.details = undefined;
				this.detailRevision++;
			}
			this.post(update);
		} catch (error) {
			if (revision === this.revision && !this.disposed) {
				this.lastHistory = undefined;
				this.commits.clear(); this.details = undefined; this.detailRevision++;
				void vscode.commands.executeCommand('setContext', 'fastSwitchProjects.graph.hasRepository', false);
				this.post({ type: 'error', message: String(error.message || error) });
			}
		}

	}

	private async receive (value: unknown): Promise<void> {

		if (!value || typeof value !== 'object' || this.disposed) return;
		const message = <{ type?: string; id?: string; index?: number; repositoryId?: string; name?: string; kind?: string; importance?: string }>value;
		switch (message.type) {
			case 'ready': this.lastHistory = undefined; this.limit = this.pageSize(); await this.refresh(); break;
			case 'refresh': await this.refresh(); break;
			case 'more': this.limit = Math.min(5000, this.limit + this.pageSize()); await this.refresh(); break;
			case 'scope':
				await this.context.workspaceState.update('graph.allBranches', !this.allBranches());
				this.limit = this.pageSize(); await this.refresh(); break;
			case 'repository':
				if (message.id !== '' && !this.api?.repositories.some((repo) => repo.rootUri.toString() === message.id)) return;
				await this.context.workspaceState.update('graph.repository', message.id || undefined);
				this.limit = this.pageSize(); await this.refresh(); break;
			case 'base': await this.chooseBase(); break;
			case 'mode':
				await this.context.workspaceState.update('graph.simple', !this.context.workspaceState.get('graph.simple', true));
				await this.refresh(); break;
			case 'importance-filter':
				if (!['all', 'active', 'important'].includes(message.id)) return;
				await this.context.workspaceState.update('graph.importanceFilter', message.id);
				await this.refresh(); break;
			case 'importance': await this.setImportance(message); break;
			case 'commit': await this.selectCommit(message.id); break;
			case 'close': this.detailRevision++; this.details = undefined; break;
			case 'copy':
				if (this.commits.has(message.id)) await vscode.env.clipboard.writeText(message.id);
				break;
			case 'diff': await this.openDiff(message.id, message.index); break;
		}

	}

	private async setImportance (message: { repositoryId?: string; name?: string; kind?: string; importance?: string }): Promise<void> {

		const repository = this.repository;
		if (!repository || !this.api || !vscode.workspace.isTrusted || message.repositoryId !== repository.rootUri.toString()
			|| !['important', 'normal', 'archived'].includes(message.importance)) return;
		const ref = Array.from(this.commits.values()).reduce<Commit['references']>((all, commit) => all.concat(commit.references), [])
			.find((reference) => reference.name === message.name && reference.kind === message.kind);
		const key = ref && branchKey(ref);
		if (!key) return;
		await (await this.importanceStore(repository)).set(key, <Importance>message.importance);
		await this.refresh();

	}

	private async chooseBase (): Promise<void> {

		const repository = this.repository;
		if (!repository || !this.api || !vscode.workspace.isTrusted) return;
		const branches = await new GitReader(this.api.git.path, repository.rootUri.fsPath).branches();
		const key = `graph.base.${repository.rootUri.toString()}`;
		const current = this.context.workspaceState.get<string>(key, '');
		const items = [
			{ label: 'Auto', description: 'Remote default branch, then main or master', ref: '', picked: !current },
			...branches.filter((branch) => !branch.target).map((branch) => ({
				label: branch.name, description: branch.ref.startsWith('refs/remotes/') ? 'Remote branch' : 'Local branch',
				ref: branch.ref, picked: current === branch.ref,
			})),
		];
		const selected = await vscode.window.showQuickPick(items, {
			title: `Graph base branch: ${basename(repository.rootUri.fsPath)}`,
			placeHolder: 'Highlight this branch and its first-parent history',
		});
		if (!selected || this.disposed) return;
		await this.context.workspaceState.update(key, selected.ref || undefined);
		await this.refresh();

	}

	private async selectCommit (id: string): Promise<void> {

		const commit = this.commits.get(id);
		const repository = this.repository;
		if (!commit || !repository || !this.api) return;
		const detailRevision = ++this.detailRevision;
		const changes = await new GitReader(this.api.git.path, repository.rootUri.fsPath).changes(commit);
		if (repository !== this.repository || detailRevision !== this.detailRevision || this.disposed) return;
		this.details = { repository, commit, changes };
		this.post({ type: 'details', commit, changes });

	}

	private async openDiff (id: string, index: number): Promise<void> {

		const details = this.details;
		if (!details || details.commit.id !== id || !Number.isInteger(index) || !this.api) return;
		const change = details.changes[index];
		if (!change) return;
		const empty = vscode.Uri.parse('fast-switch-projects-empty:/empty');
		const original = change.before ? vscode.Uri.joinPath(details.repository.rootUri, change.before) : undefined;
		const before = original && details.commit.parentIds[0] ? this.api.toGitUri(original, details.commit.parentIds[0]) : empty;
		const after = change.after ? this.api.toGitUri(vscode.Uri.joinPath(details.repository.rootUri, change.after), details.commit.id) : empty;
		await vscode.commands.executeCommand('vscode.diff', before, after,
			`${basename(change.after || change.before)} (${details.commit.id.slice(0, 8)})`, { preview: true });

	}

	async gitOperation (operation: 'fetch' | 'pull' | 'push'): Promise<void> {

		const repository = this.repository;
		if (!repository || !this.api || !vscode.workspace.isTrusted || this.operationRunning) return;
		this.operationRunning = true;
		try {
			const title = `Git ${operation}: ${basename(repository.rootUri.fsPath)}`;
			await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title },
				() => repository[operation]());
		} catch (error) {
			await vscode.window.showErrorMessage(`Git ${operation}: ${String(error.message || error)}`);
		} finally {
			this.operationRunning = false;
			await this.refresh();
		}

	}

	private post (message: Record<string, unknown>): void {

		if (!this.disposed) void this.view?.webview.postMessage(message);

	}

	dispose (): void {

		this.disposed = true;
		if (this.referenceTimer) clearInterval(this.referenceTimer);
		this.revision++;
		if (this.timer) clearTimeout(this.timer);
		this.gitEnablementSubscription?.dispose();
		this.apiSubscriptions.forEach((subscription) => subscription.dispose());
		this.subscriptions.forEach((subscription) => subscription.dispose());
		this.repositorySubscriptions.forEach((subscription) => subscription.dispose());

	}

}

export function activate (context: vscode.ExtensionContext): void {

	const provider = new GraphProvider(context);
	context.subscriptions.push(provider,
		vscode.window.registerWebviewViewProvider('fastSwitchProjectsGraph', provider),
		vscode.commands.registerCommand('fastSwitchProjects.graph.refresh', () => provider.refresh()),
		...(['fetch', 'pull', 'push'] as const).map((operation) => {

			return vscode.commands.registerCommand(`fastSwitchProjects.graph.${operation}`, () => provider.gitOperation(operation));

		}),
		vscode.workspace.registerTextDocumentContentProvider('fast-switch-projects-empty', { provideTextDocumentContent: () => '' }));

}
