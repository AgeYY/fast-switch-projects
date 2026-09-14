/* Fast Switch Projects graph UI. Git text is always inserted with textContent. */
(function () {
    const vscode = acquireVsCodeApi();
    const $ = id => document.getElementById(id);
    let selected = '';
    let rows = [];
    let repositoryId = '';
    let hasHistory = false;
    const branchColors = new Map(vscode.getState()?.branchColors || []);
    const branchPalette = ['#ff91bf', '#ffd45c', '#b7a0ff', '#ffad72', '#a8e86c', '#65dfd2',
        '#91baff', '#f0a5ed', '#e6d78d', '#8ce4ad', '#ff9292', '#8dd9f2'];
    function branchColor(ref) {
        const name = ref.kind === 'remote' ? ref.name.slice(ref.name.indexOf('/') + 1) : ref.name;
        if (!branchColors.has(name)) {
            const index = branchColors.size;
            branchColors.set(name, branchPalette[index] || `hsl(${Math.round(index * 137.508) % 360}, 78%, 75%)`);
        }
        return branchColors.get(name);
    }
    let branchMenu;
    function closeBranchMenu() {
        if (branchMenu) branchMenu.remove();
        branchMenu = undefined;
    }
    function decorateBranch(badge, ref, importance = 'normal') {
        badge.dataset.branchName = ref.name;
        badge.dataset.importance = importance;
        badge.classList.add(`priority-${importance}`);
        if (importance === 'important') badge.textContent = `★ ${badge.textContent}`;
        badge.title = `${ref.name} · ${importance}\nRight-click to change importance`;
        badge.addEventListener('contextmenu', event => {
            event.preventDefault();
            event.stopPropagation();
            closeBranchMenu();
            const targetRepository = repositoryId;
            const menu = document.createElement('div');
            branchMenu = menu;
            menu.className = 'branch-menu';
            menu.setAttribute('role', 'menu');
            menu.setAttribute('aria-label', `Importance of ${ref.name}`);
            menu.append(text('div', ref.name, 'branch-menu-title'));
            for (const [value, label] of [['important', '★ Important'], ['normal', 'Normal'], ['archived', 'Archived']]) {
                const option = text('button', `${importance === value ? '✓ ' : ''}${label}`);
                option.setAttribute('role', 'menuitemradio');
                option.setAttribute('aria-checked', String(importance === value));
                option.addEventListener('click', () => {
                    closeBranchMenu();
                    badge.closest('.commit')?.focus({ preventScroll: true });
                    send('importance', { repositoryId: targetRepository, name: ref.name, kind: ref.kind, importance: value });
                });
                menu.append(option);
            }
            menu.addEventListener('keydown', key => {
                const options = Array.from(menu.querySelectorAll('button'));
                const index = options.indexOf(document.activeElement);
                if (key.key === 'Escape') { closeBranchMenu(); badge.closest('.commit')?.focus(); }
                else if (key.key === 'ArrowDown' || key.key === 'ArrowUp') {
                    key.preventDefault();
                    options[(index + (key.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length].focus();
                }
            });
            document.body.append(menu);
            menu.style.left = `${Math.max(0, Math.min(event.clientX, document.documentElement.clientWidth - menu.offsetWidth))}px`;
            menu.style.top = `${Math.max(0, Math.min(event.clientY, window.innerHeight - menu.offsetHeight))}px`;
            menu.querySelector('button').focus();
        });
    }
    document.addEventListener('pointerdown', event => {
        if (branchMenu && !branchMenu.contains(event.target)) closeBranchMenu();
    }, true);
    window.addEventListener('blur', closeBranchMenu);
    const graphSizes = new ResizeObserver(entries => {
        for (const entry of entries) {
            const button = entry.target;
            const row = rows.find(row => row.historyItem.id === button.dataset.id);
            const height = Math.ceil(button.getBoundingClientRect().height);
            if (!row || button.dataset.graphHeight === String(height)) continue;
            button.dataset.graphHeight = String(height);
            const svg = window.renderSCMHistoryItemGraph(row, height);
            svg.setAttribute('aria-hidden', 'true');
            button.querySelector('svg').replaceWith(svg);
        }
    });
    function send(type, rest = {}) { vscode.postMessage({ type, ...rest }); }
    function text(tag, value, className) {
        const element = document.createElement(tag);
        element.textContent = value;
        if (className) element.className = className;
        return element;
    }
    function select(id) {
        selected = id;
        document.querySelectorAll('.commit').forEach(row => {
            row.classList.toggle('selected', row.dataset.id === id);
            row.setAttribute('aria-pressed', String(row.dataset.id === id));
        });
        $('details').hidden = true;
        send('commit', { id });
    }
    $('importance-filter').addEventListener('change', event => send('importance-filter', { id: event.target.value }));
    $('repository').addEventListener('change', event => send('repository', { id: event.target.value }));
    for (const id of ['refresh', 'scope', 'more', 'base', 'mode']) $(id).addEventListener('click', () => send(id));
    $('copy').addEventListener('click', () => send('copy', { id: selected }));
    $('close').addEventListener('click', () => { $('details').hidden = true; send('close'); });
    window.addEventListener('message', ({ data }) => {
        if (!data || typeof data.type !== 'string') return;
        if (data.type === 'loading') {
            if (!hasHistory) $('status').textContent = 'Loading graph…';
            $('history').setAttribute('aria-busy', 'true');
            return;
        }
        if (data.type === 'settled') {
            $('history').setAttribute('aria-busy', 'false');
            return;
        }
        if (data.type === 'error') {
            hasHistory = false;
            closeBranchMenu();
            rows = [];
            $('status').textContent = data.message;
            $('base').hidden = true;
            $('summary').textContent = '';
            graphSizes.disconnect();
            $('history').replaceChildren();
            $('history').setAttribute('aria-busy', 'false');
            $('details').hidden = true;
            $('more').hidden = true;
            return;
        }
        if (data.type === 'history') {
            closeBranchMenu();
            $('importance-filter').value = data.importanceFilter;
            const sameRepository = repositoryId === data.repositoryId;
            repositoryId = data.repositoryId;
            hasHistory = true;
            const focusedId = document.activeElement?.closest('.commit')?.dataset.id;
            rows = data.rows;
            document.body.classList.toggle('simple', data.simple);
            $('mode').textContent = data.simple ? 'Simple' : 'Full';
            $('mode').setAttribute('aria-pressed', String(data.simple));
            $('summary').textContent = data.simple && data.hiddenCount ? `${data.hiddenCount} intermediate commits hidden` : '';
            $('history').setAttribute('aria-busy', 'false');
            const options = [text('option', 'Auto')];
            options[0].value = '';
            for (const repo of data.repositories) {
                const option = text('option', repo.name);
                option.value = repo.id;
                option.title = repo.path;
                options.push(option);
            }
            $('repository').replaceChildren(...options);
            $('repository').value = data.selected;
            $('scope').textContent = data.allBranches ? 'All branches' : 'Current';
            $('scope').setAttribute('aria-pressed', String(data.allBranches));
            $('branch').textContent = [data.repository, data.branch,
                data.ahead ? `↑ ${data.ahead}` : '', data.behind ? `↓ ${data.behind}` : ''].filter(Boolean).join(' · ');
            $('base').hidden = !data.hasRepository;
            $('base').textContent = data.base ? `Base: ${data.base.name}${data.base.source === 'selected' ? '' : ' (auto)'}`
                : data.baseOverride ? 'Base: unavailable — choose branch' : 'Base: choose branch';
            $('base').title = data.base ? `${data.base.name} · ${data.base.source === 'selected' ? 'Selected manually' : data.base.source === 'remote' ? 'Detected from remote HEAD' : 'Detected by branch name'}\nThick line: first-parent history. Click to change.`
                : 'Choose the branch to highlight. This only changes the graph display.';
            $('status').textContent = rows.length ? '' : data.emptyMessage;
            const fragment = document.createDocumentFragment();
            for (const row of rows) {
                const commit = row.historyItem;
                const item = document.createElement('div');
                item.setAttribute('role', 'listitem');
                const button = document.createElement('button');
                button.className = row.base ? 'commit base-commit' : 'commit';
                button.dataset.id = commit.id;
                const subject = commit.message.split('\n')[0];
                button.title = `${commit.id}\n${commit.author} · ${commit.date}\n\n${commit.message}`;
                button.setAttribute('aria-label', `${row.kind === 'HEAD' ? 'HEAD, ' : ''}${row.base ? 'Base branch history, ' : ''}${subject}, ${commit.author}, ${commit.id.slice(0, 8)}`);
                const svg = window.renderSCMHistoryItemGraph(row);
                svg.setAttribute('aria-hidden', 'true');
                const content = document.createElement('span');
                content.className = 'commit-content';
                if (!data.simple) content.append(text('span', subject, 'subject'));
                const refs = document.createElement('span');
                refs.className = 'refs';
                button.append(svg, content);
                if (data.base && commit.id === data.base.id) {
                    const badge = text('span', 'BASE', 'ref base');
                    decorateBranch(badge, { name: data.base.name, kind: data.base.ref.startsWith('refs/remotes/') ? 'remote' : 'local' }, data.baseImportance);
                    refs.append(badge);
                }
                if (row.kind === 'HEAD') refs.append(text('span', 'HEAD', 'ref head'));
                const locals = new Set(commit.references.filter(ref => ref.kind === 'local').map(ref => ref.name));
                for (const ref of commit.references) {
                    if (data.simple && ref.kind === 'remote' && (ref.name.endsWith('/HEAD') || locals.has(ref.name.slice(ref.name.indexOf('/') + 1)))) continue;
                    if (data.base && commit.id === data.base.id && ref.name === data.base.name && ref.kind === (data.base.ref.startsWith('refs/remotes/') ? 'remote' : 'local')) continue;
                    const badge = text('span', ref.name, `ref ${ref.kind}`);
                    badge.title = ref.name;
                    if (ref.kind === 'local' || ref.kind === 'remote') {
                        badge.style.backgroundColor = branchColor(ref);
                        if (ref.kind === 'local' || !ref.name.endsWith('/HEAD')) decorateBranch(badge, ref, ref.importance);
                    }
                    refs.append(badge);
                }
                if (data.simple && (row.summary === 'Merge' || row.summary === 'Branch point' || !refs.childElementCount)) {
                    content.append(text('span', row.kind === 'HEAD' && !refs.childElementCount ? 'Current commit' : row.summary, 'node-summary'));
                }
                if (refs.childElementCount) content.append(refs);
                button.addEventListener('click', () => select(commit.id));
                button.addEventListener('keydown', event => {
                    const buttons = Array.from(document.querySelectorAll('.commit'));
                    const current = buttons.indexOf(button);
                    let next;
                    if (event.key === 'ArrowDown') next = Math.min(buttons.length - 1, current + 1);
                    if (event.key === 'ArrowUp') next = Math.max(0, current - 1);
                    if (event.key === 'Home') next = 0;
                    if (event.key === 'End') next = buttons.length - 1;
                    if (next !== undefined) { event.preventDefault(); buttons[next].focus(); }
                });
                item.append(button);
                fragment.append(item);
            }
            vscode.setState({ ...vscode.getState(), branchColors: Array.from(branchColors) });
            graphSizes.disconnect();
            $('history').replaceChildren(fragment);
            document.querySelectorAll('.commit').forEach(button => graphSizes.observe(button));
            $('more').hidden = !data.hasMore;
            if (sameRepository && selected && rows.some(row => row.historyItem.id === selected)) {
                document.querySelectorAll('.commit').forEach(button => {
                    button.classList.toggle('selected', button.dataset.id === selected);
                    button.setAttribute('aria-pressed', String(button.dataset.id === selected));
                });
            } else {
                selected = '';
                $('details').hidden = true;
            }
            if (sameRepository && focusedId) {
                Array.from(document.querySelectorAll('.commit')).find(button => button.dataset.id === focusedId)?.focus({ preventScroll: true });
            }
        }
        if (data.type === 'details' && data.commit.id === selected) {
            $('details').hidden = false;
            $('hash').textContent = data.commit.id.slice(0, 8);
            $('hash').title = data.commit.id;
            $('author').textContent = `${data.commit.author} · ${new Date(data.commit.date).toLocaleString()}`;
            $('message').textContent = data.commit.message;
            $('comparison').textContent = data.commit.parentIds.length > 1 ? 'Changes against the first parent' : 'Changed files';
            $('files').replaceChildren();
            data.changes.forEach((file, index) => {
                const button = text('button', `${file.status}  ${file.after || file.before}`, 'file');
                button.title = file.before && file.before !== file.after ? `${file.before} → ${file.after || '(deleted)'}` : file.after;
                button.addEventListener('click', () => send('diff', { id: data.commit.id, index }));
                $('files').append(button);
            });
            if (!data.changes.length) $('files').append(text('div', 'No file changes.'));
        }
    });
    send('ready');
})();
