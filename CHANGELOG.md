# Change Log

All notable changes to Fast Switch Projects are documented in this file.

## [1.5.0] - 2026-09-13

### Added

- Right-click a branch badge to mark it Important, Normal, or Archived.
- Star and outline important branches; fade archived branches without changing assigned colors.
- Filter to Important only or Hide archived while preserving HEAD, base, and connecting merge history.
- Save priorities locally in Git's common directory so linked worktrees share them without changing code or GitHub.

## [1.4.2] - 2026-09-13

### Changed

- Soften branch badges with lower brightness and saturation while preserving each branch's assigned color.

## [1.4.1] - 2026-09-13

### Changed

- Give branch labels individual colors that persist across refreshes and reloads, with matching local/remote colors.

## [1.4.0] - 2026-09-13

### Added

- Default to a simple graph of branch endpoints, HEAD, merges, branch points, and history boundaries.
- Collapse intermediate linear commits, omit their messages, and hide duplicate remote branch labels.
- Toggle Simple/Full history with a remembered preference; click retained nodes for original commit details.

## [1.3.3] - 2026-09-13

### Changed

- Use vivid graph lines and colorful branch badges with contrasting text.
- Keep background refreshes silent and skip redraws when history is unchanged.
- Preserve commit details and keyboard focus during graph updates.

### Fixed

- Restore commit file details after the branch-label layout change.

## [1.3.2] - 2026-09-13

### Fixed

- Wrap branch badges below commit subjects so new branches stay visible in narrow sidebars; show full names on hover.
- Check Git references every two seconds while Graph is visible, covering terminal changes and sibling worktrees.
- Keep graph lines connected across rows with multiple branch badges.

## [1.3.1] - 2026-09-13

### Changed

- Shorten the base branch badge to BASE; keep the branch name in the Base selector.
- Correct dependency lock metadata affected by earlier extension-version updates.

## [1.3.0] - 2026-09-13

### Added

- Highlight the base branch with a BASE badge and a thicker blue first-parent history line.
- Detect the default branch from local remote HEAD metadata, falling back to main or master.
- Choose a different base branch from Graph and remember the selection per repository and workspace.
- Include the base branch in Current history mode, alongside HEAD and its upstream.

## [1.2.1] - 2026-09-13

### Fixed

- Resolve saved slot and current workspace URIs through VS Code so the green current-project arrow survives extension-host changes.
- Refresh the Slots indicator when its window regains focus.

## [1.2.0] - 2026-09-13

### Changed

- Replace the Workspaces panel with direct Add Project and Remove Project controls in Slots.
- Append selected folders, workspace files, and previously saved unslotted projects automatically, without group assignment.
- Preserve the position of projects already in Slots when they are selected again.
- Remove a project registration and close its slot gap without deleting files or closing windows.
- Keep drag-to-reorder and move commands; show a single remove button on each slot row.
- Preserve existing slot data, legacy commands, and import/export compatibility.

## [1.1.1] - 2026-09-13

### Changed

- Default Graph to All branches while preserving explicitly saved scope choices.
- Default the Workspaces pane to collapsed while respecting existing VS Code view layouts.

## [1.1.0] - 2026-09-13

### Added

- An independent Graph webview below Slots and Workspaces, adapting VS Code's MIT-licensed SVG renderer.
- Repository selection, current/upstream or all-branch history, branch/tag labels, HEAD markers, and paginated loading.
- Commit details and file diffs, including first-parent merge changes, initial commits, renames, and deletions.
- Fetch, pull, push, refresh, automatic Git-state refresh, and per-workspace graph preferences.
- Separate graph layout, interaction, and style modules for customization.

### Changed

- Prefer the workspace extension host so Remote SSH history runs beside its repository. Git is activated only for Graph; project switching remains available when Git is disabled.
- Return a failing test process status when Mocha reports failures.

## [1.0.0] - 2026-08-08

### Added

- Added an occupied-only Slots view with unlimited ordered assignments.
- Added direct shortcuts for slots 1 through 9 and navigation across every occupied slot.
- Added next, previous, first, last, and searchable slot-opening commands.
- Added drag-and-drop reordering for workspace, workspace-group, and tag slots.
- Added keyboard-friendly move, insert, and remove-with-close-gap commands.
- Added current-workspace identification in direct, group, and tag slots.
- Added cross-window refresh for shared project and slot data.
- Added JSON export and import for projects, groups, tags, favorites, and slots.
- Added automatic group and slot assignment for explicitly added projects.
- Added optional automatic new-window opening after **Add Project...** and **Add Workspace Project...**.

### Changed

- Rebranded the extension as Fast Switch Projects with independent extension, command, view, and setting identifiers.
- Set Visual Studio Code 1.69 as the minimum supported version.
