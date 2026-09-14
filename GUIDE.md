# Fast Switch Projects guide

## Project views

Fast Switch Projects provides **Slots** and **Graph** panes. The **Slots** view appears first and contains the projects you choose.

The slot containing the current workspace has a green arrow and a **Current Workspace** description. Direct workspace assignments are matched first. Group and tag slots are also recognized when they contain the current workspace.

## Git graph

See the [Git graph guide in README.md](README.md#git-graph) for repository selection, history scope, diffs, synchronization controls, and renderer customization.

## Add projects

Click **+** in the Slots header to select a project folder. The header's **…** menu provides **Add Workspace Project...** for `.code-workspace` files and **Add Current Project to Slots** for the active project. Projects are appended in selection order with no separate group or slot-assignment step.

An already slotted project keeps its position. Previously saved projects without slots can be added again. With `fastSwitchProjects.openNewProjectsInNewWindow` enabled, newly assigned projects open in separate VS Code windows after their state is saved. Adding the current project never opens another window.

## Remove projects

Click **×** on a slot row or choose **Remove Project from Slots** from its context menu. The selected entry is removed and later slots shift up. For a project slot, its saved project registration is also removed. This does not delete files or close windows. Existing group/tag slots can be removed from Slots without deleting their group/tag definitions.

## Reorder slots

Drag an occupied slot onto another slot to move it to that position. Intervening slots shift without being overwritten. Drop a slot on empty space below the rows to move it to the end.

Each row's context menu also provides move-up and move-down commands. The corresponding Command Palette commands support keyboard-only operation.

Inserting an already assigned workspace, group, or tag moves its existing slot. Inserting an unassigned item shifts later slots down. Removing a slot with **Remove Slot and Close Gap** shifts later slots up.

## Navigate slots

Direct keyboard shortcuts are available for slots 1 through 9. Slots above 9 can be opened from the Slots view or **Open Slot...** picker.

Next and previous navigation skip empty slots and wrap around at the ends. First and last navigation select the corresponding occupied boundaries.

| Action | Windows/Linux | macOS |
| --- | --- | --- |
| Open extension view | `Ctrl+L Ctrl+I` | `Cmd+L Cmd+I` |
| Next slot | `Ctrl+L Ctrl+J` | `Cmd+L Cmd+J` |
| Previous slot | `Ctrl+L Ctrl+K` | `Cmd+L Cmd+K` |
| First slot | `Ctrl+L Ctrl+A` | `Cmd+L Cmd+A` |
| Last slot | `Ctrl+L Ctrl+E` | `Cmd+L Cmd+E` |

## Synchronization

Project, group, tag, favorite, and slot data use VS Code global extension storage. Open VS Code windows refresh their Fast Switch Projects views when shared data changes or a window regains focus.

## Backup and restore

Use these Command Palette commands:

- **Fast Switch Projects: Export Data...**
- **Fast Switch Projects: Import Data...**

The JSON backup contains projects, favorites, workspace groups, favorite groups, tags, and slots. Import validates the structure and asks for confirmation before replacing current data.

## Build the preview

```bash
npm ci
npm run compile
npm test
npx @vscode/vsce package --no-dependencies --out fast-switch-projects-1.5.0.vsix
```

The compile step builds the extension and runs its tests; `npm test` reruns the compiled test suite. Runtime code is bundled, so packaging does not need to include development dependencies. The generated VSIX is intentionally ignored by Git.

For installation on another computer or an SSH host, see [Installation](README.md#installation). Git pushes publish the source branch only; Marketplace publication is a separate step.

## Development-build migration

The development extension `zeyuan.ordered-projects` and public extension `ZeyuanYe.fast-switch-projects` have separate VS Code storage. To migrate:

1. Run **Ordered Projects: Export Data...** in the development build.
2. Install Fast Switch Projects.
3. Run **Fast Switch Projects: Import Data...** and select the exported JSON file.
4. Verify the slots, groups, and projects before uninstalling Ordered Projects.
