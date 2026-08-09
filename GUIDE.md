# Fast Switch Projects guide

## Project views

Fast Switch Projects provides separate views for ordered slots, favorites, workspaces, and tags. The **Slots** view appears first and shows occupied entries only.

The slot containing the current workspace has a green arrow and a **Current Workspace** description. Direct workspace assignments are matched first. Group and tag slots are also recognized when they contain the current workspace.

## Add projects

Use **Add Project...** to select folders or **Add Workspace Project...** to select `.code-workspace` files. New projects are automatically placed in the first custom workspace group and assigned the slot after the last occupied slot. Multiple selections receive consecutive slots in selection order.

If no custom workspace group exists, the extension creates one named **Projects**.

With `fastSwitchProjects.openNewProjectsInNewWindow` enabled, every project selected through the two Add commands opens in a separate new VS Code window after it is stored and organized. Disable the setting to register projects without opening them. **Save Project...** never opens a duplicate window for the active project.

Renaming, importing, scanning, or detecting projects does not trigger automatic group, slot, or window assignment.

## Reorder slots

Drag an occupied slot onto another slot to move it to that position. Intervening slots shift without being overwritten. Drop a slot on empty space below the rows to move it to the end.

Every occupied row also provides move-up and move-down buttons. The corresponding Command Palette commands support keyboard-only operation.

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
npx @vscode/vsce package
```

The generated VSIX is intentionally ignored by Git.

## Development-build migration

The development extension `zeyuan.ordered-projects` and public extension `ZeyuanYe.fast-switch-projects` have separate VS Code storage. To migrate:

1. Run **Ordered Projects: Export Data...** in the development build.
2. Install Fast Switch Projects.
3. Run **Fast Switch Projects: Import Data...** and select the exported JSON file.
4. Verify the slots, groups, and projects before uninstalling Ordered Projects.
