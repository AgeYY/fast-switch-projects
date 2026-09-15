# Prototype validation — 2026-09-14

## Source preservation

- Inspected `/home/zeyuan/ordered-projects-duplicate-project` on `feat/duplicate-project`.
  Duplication/rename implementation was uncommitted, based on `aee95d7`.
- Created sibling `/home/zeyuan/ordered-projects-single-visible-window`, branch
  `feat/single-visible-window`, and copied the exact tracked patch and nonignored
  untracked files. The original checkout was not modified.
- Created Windows worktree
  `C:\Users\63001\Developer\fast-switch-projects-window-prototype` on the same branch
  in a local clone, with the same source snapshot. Source work remains uncommitted.
- No push, merge or publication. VSIX packaging is local, not Marketplace publication.
- Verified all 353 files in the original snapshot byte-for-byte against the original
  checkout after implementation: zero differences; its tracked binary diff also matches.

## Installed/staged state

- Windows companion 0.1.0 installed in both Default and the existing `cursor` profile.
  No project windows were registered and the mode remains off.
- Fast Switch Projects 1.5.1 installed in the remote server's Default profile.
  The active remote `cursor` profile still references 1.5.0. Its update is deferred
  with live testing: use **Extensions: Install from VSIX** in a Remote-SSH `cursor`
  window and select `fast-switch-projects-1.5.1-single-window.vsix` from local
  `prototype/results/`, then reload only the disposable test windows.
- Both VSIX packages are under local `prototype/results/`. The companion package
  was checked byte-for-byte against its built binary and source; fixtures are excluded.
- Disposable remote A/B/C workspaces are prepared under remote
  `prototype/results/three-projects/`. After the VS Code update, run local
  `prototype/open-three-projects.ps1`, then register each test window and enable mode.

## Observed results

### Live local VS Code follow-up

The updater finished; live tests ran on VS Code **1.137.0**, commit
`645f29cc3176500b4b5762ba887cf2a7f0ffdf2c`, in a disposable user-data directory.
No user project windows were registered or closed.

- Three actual VS Code workspaces were tested; A and B referenced the same folder.
- **30 public project-open command switches passed**. Median **19.84 ms**, p95
  **30.97 ms**, maximum **127.62 ms**, measured inside the extension from command
  dispatch to completion (excluding the external test queue's polling time).
- Each switch left exactly one registered native window visible and the destination
  focused. All three extension-host PIDs, terminal PIDs and unsaved editor tabs
  survived unchanged. The three Python child processes were independently checked alive.
- The user confirmed inactive A/B/C windows disappeared from taskbar previews and
  Alt+Tab, while unrelated VS Code windows remained available.
- Restored-window geometry transferred exactly: native rectangle
  `(232, 90)-(1688, 998)`. Two monitors were reported; cross-monitor and mixed-DPI
  behavior still need a direct test.
- Killing the live native broker restored all three real windows in **962 ms**.
  The companion subsequently rebound their handles. Show All and setting=false
  left all windows visible.
- Closing the active project restored survivors and paused hiding. Reopening
  restored its unsaved editor and registered a different HWND and extension host.
  Its terminal did not return after close; process preservation applies to switching,
  not to explicitly closing a project window.
- A background focus request was rejected by Windows; the feature restored all
  windows and paused hiding. Foreground user-initiated switching then passed.
- The disposable local windows were closed after testing, and their test Python
  processes exited. Test mode is off.

Evidence is in ignored `prototype/results/live-validation.json`, plus the individual
`live-local.json`, `live-geometry-recovery.json` and `live-close-reopen.json` files.
The live driver invokes the same public command used by project opening; physical
slot keybindings and sidebar mouse interaction have not yet been separately tested.

The first close/reopen attempt exposed stale-command replay in the **test harness**;
it was fixed by binding requests to extension-host PIDs, and the close/reopen check
then passed. The shipped companion implementation was not changed by this fix.

### Remote-SSH live follow-up

- All three disposable A/B/C workspaces connected through `weixx2`, using
  Remote-SSH 0.128.0 and the isolated profile's `remote.SSH.useLocalServer=true`.
  The user trusted all three remote workspaces. A/B reference the same remote folder.
- Thirty switches through the public project-open command passed: median
  **122.59 ms**, p95 **160.51 ms**, maximum **161.82 ms**. These command timings
  include remote command routing but exclude filesystem request polling and do
  not measure display-paint latency.
- Each switch left exactly one managed window visible and the destination focused.
  Local UI extension-host PIDs, independent dirty editor tabs, and remote terminal
  shell PIDs survived unchanged. The SSH connection remained usable.
- Independently checked remote Python children alive after all switches:
  A `3001818` (shell `3001784`), B `3001862` (shell `3001822`),
  C `3001908` (shell `3001880`). These checks establish survival through switching;
  explicit project close/reopen was a later, separate test.
- Restored native rectangle transferred exactly: `(232, 90)-(1688, 998)`.
  Killing only the disposable profile's helper restored all three windows in
  **395 ms**. Show All and setting=false passed; registration recovered.
- Active remote project closure restored survivors and paused hiding. Reopening
  restored its unsaved editor and registered a new HWND (`1247562 -> 394132`)
  and UI extension host (`19492 -> 58696`). Terminal persistence after an explicit
  close is not claimed. The test now polls for actual window closure because
  remote shutdown exceeded its original fixed 600 ms wait; no production fix
  was required.
- Evidence: ignored `live-remote.json`, `live-remote-geometry-recovery.json`, and
  `live-remote-close-reopen.json` under `prototype/results/`. All three remote test
  windows are left accessible with single-window mode disabled.
- Two monitors are available. Real maximization, cross-monitor/mixed-DPI, physical
  sidebar/shortcut, and cold first-open timing checks remain outstanding. The
  attempted `workbench.action.toggleMaximizedWindow` command is unavailable in
  this build; no live maximization result is claimed.

### Initial automated prototype checks

| Check | Result |
|---|---|
| Original remote extension build | Passed; 364 existing tests passed on Linux |
| TypeScript `tsc --noEmit` | Passed on Windows |
| Existing tests on Windows | 362 passed; 2 pre-existing Git filename tests use tabs/newlines illegal in Windows paths |
| Existing lint | One inherited `func-style` error and one length warning in duplication changes in `src/commands/hotkeys.ts`; new bridge passes lint |
| Native helper build | Passed with Windows .NET Framework compiler |
| Companion tests | 9 passed: 4 extension mocks, 4 identity checks, one multi-scenario native fixture |
| Native three-window switching | Synthetic fixture passed; only one of three managed windows visible |
| Unrelated window exclusion | Fourth synthetic window stayed visible |
| Position/size and maximization | Passed in native fixture |
| Show all / disabled routing | Native restoration and extension-mock routing passed |
| Killed helper recovery | Independent watchdog restored the fixture windows |
| Heartbeat loss | Hidden fixture windows restored after lease expiry |
| Active window closure | Remaining fixture windows restored |
| Remote/local command transport | Implemented using documented VS Code command routing; not live tested |
| Real VS Code, taskbar, Alt+Tab, sessions, reopen | Deferred: VS Code updater blocked isolated-window startup |
| Multiple monitors | Not tested; monitor inventory alone does not establish usable monitor/DPI behavior |

The latest recorded native fixture run made 17 timed switches. Median was
**10.65 ms**, range **7.54–273.39 ms**. The slow samples include the fixture's
deliberate 250 ms focus-fallback wait. These are synthetic broker/Win32 timings;
**these initial measurements are superseded by the live local results above**.

VS Code CLI reported `1.132.0`, commit `df53daabb18cd157bdb08c7f01c34df936cf12f4`.
Its isolated instance logged: `Code is currently being updated. Please wait for
the update to complete before launching.` The user agreed to defer this update.
Computer Use also reported its native pipe unavailable after retry/reset.
No existing VS Code project was closed or hidden for validation.

## Full three-project acceptance checklist (remaining manual items noted above)

1. Open A and B as distinct saved workspace files referencing one source folder;
   C references another folder. Use Remote-SSH for all three. Keep an unrelated
   VS Code window open to verify exclusion.
2. Register A/B/C, create a distinct unsaved editor and a long-running terminal
   command in each, record extension-host/terminal/process IDs, then enable mode.
3. Switch with sidebar actions, numbered slots, next/previous and previous-project
   shortcuts. Check taskbar previews and Alt+Tab show only the active managed window.
4. Switch from restored, maximized and moved windows. Check normal restore bounds,
   foreground focus, all available monitors and mixed DPI if present.
5. Verify unsaved editors, terminal buffers and process IDs remain independent
   and alive. Record command-to-focused-visible latency over at least 30 switches.
6. Close the active project, verify all survivors become accessible, reopen that
   approved workspace and resume mode. Confirm its new HWND is bound safely.
7. Test Show All, setting=false, companion deactivation, killed/hung helper, cold
   startup delay, rejected focus, and rapid overlapping switch commands.

`prototype/harness/` contains an optional test-only local extension for A/B/C
workspaces. It exposes a filesystem request queue solely in that isolated test
environment and is excluded from both shipped VSIX packages. Fixture artifacts,
runtime state and logs live under ignored `prototype/results/`.

## Open All Listed Projects follow-up

- Added `Fast Switch Projects: Open All Listed Projects` in main extension 1.5.2,
  exposed in the Command Palette and Slots menu. Opens unique listed paths in slot
  order, expands group/tag slots, preserves distinct workspace files and the
  invoking window, pauses companion hiding, and supports cancellation and per-path
  error reporting. It does not register projects automatically.
- Seven focused tests passed on Windows and Linux (`node --test
  prototype/open-listed-projects.test.js`), covering list expansion/identity,
  current-window preservation, companion-free routing, failure continuation,
  cancellation, empty state, and overlapping invocations. TypeScript and lint for
  the new modules passed. Linux packaging ran all 364 existing tests successfully.
- Packaged `fast-switch-projects-1.5.2-single-window.vsix`; verified the manifest and
  bundled command, and exclusion of prototype files. Installed in Windows Default
  and cursor profiles, remote Default, and the active remote cursor profile through
  its Remote-SSH CLI. Remote cursor extension metadata confirms 1.5.2.
- Existing active extension hosts may require Developer: Reload Window to load the
  update. The user's full project list has not been opened automatically for a live
  test. No push, merge, or publication.

## Registration guidance follow-up

- User logs confirmed Enable was invoked without workspace registration. Listing
  projects in Slots and opening them do not grant window-management registration.
- Companion 0.1.1 replaces the misleading recovery warning with setup guidance
  and an explicit Register This Window and Enable action. Dismissing it makes no
  native or registration change; choosing it binds/persists only the current
  workspace before enabling. Existing explicit registration remains available.
- Ten extension/identity checks passed, including both new setup paths. Native
  helper code/binary is unchanged. VSIX source and helper bytes verified; installed
  companion 0.1.1 in Windows Default and cursor profiles. Reload is required in
  already-active windows. The new prompt has not been exercised through live UI.

## Bulk registration follow-up

- Main 1.5.3 adds **Open and Register All Listed Projects**, paired with local
  Windows Companion 0.1.2. Explicit command invocation approves the listed URI
  identities. Per-workspace atomic records let loaded and newly started local UI
  extension hosts bind their own native windows, including across Remote-SSH.
  Unlisted windows stay unmanaged. Separate workspace files remain independent.
- Approval and explicit revocation persist. The command leaves hiding paused,
  waits up to 60 seconds for registrations, and reports pending startup/trust
  conditions. Cancellation stops further opens; the list's saved approvals remain.
- 25 focused command, extension, identity and approval-store checks passed.
  TypeScript and lint for the changed command passed. Linux packaging passed all
  364 existing tests. Native helper binary is unchanged.
- Live Remote-SSH public-command test passed with two loaded fixtures and one
  closed fixture: all three were opened/registered in **4335.61 ms**, with existing
  extension hosts and unrelated visible windows preserved. A/B used distinct
  workspace files pointing to the same source folder. Hiding remained paused.
- Live unregister, close and reopen of C retained revocation (only A/B managed).
  Repeating the new command explicitly approved and registered C again. Evidence:
  ignored `prototype/results/live-bulk-register.json`. Driver:
  `node prototype/live-bulk-register.js` with the documented disposable fixtures.
- Cleanup unregistered and closed only the three fixtures. The user's projects
  were not bulk-approved or opened by this test.
- VSIX contents verified. Main 1.5.3 and companion 0.1.2 installed in Windows
  Default/cursor profiles; main 1.5.3 installed in remote Default/cursor profiles.
  Reload existing windows to activate the updated extensions before bulk setup.
  No push, merge or publication.

## Single Windows package follow-up

- User installs only `fast-switch-projects-windows-0.2.0.vsix` locally. This
  distribution bundles the native helper and project-engine 1.5.4 VSIX, whose
  integrity is checked before automatic installation via VS Code's installer.
  The engine is workspace-only, so Git/filesystem operations run remotely for SSH.
  Existing engine identity, project data, registration logic and commands remain.
- In a fresh `FSP One Package Test` profile, installed only the Windows product
  package (plus the test harness). The engine was absent from its initial extension
  list, then installed/activated automatically. Status: version 1.5.4, kind UI,
  platform win32, no remote. No engine installation command was issued manually.
- With standard Remote-SSH installed/configured, opened a trusted remote fixture
  in that same profile. Automatic setup installed engine 1.5.4 into remote profile
  `-7d279baa`; status reported Workspace host, platform linux, remoteName ssh-remote.
  No manual SSH-host engine install or extra setup prompt was needed in this test.
- Native registration from the remote fixture also passed. A previous registration
  of local fixture A was retained; cleanup unregistered and closed both fixtures.
  Evidence: ignored `prototype/results/live-single-package.json` and companion
  setup logs under `prototype/results/logs/20260914T222603/window{1,2}/exthost/`.
- 31 focused checks passed, including six new installer cases (local setup,
  remote placement, retaining newer engines, damaged bundle, install failure and
  reload-needed upgrades). TypeScript and changed-source lint passed. Linux
  packaging passed all 364 existing tests. Native helper code is unchanged.
- The final bundle was rebuilt with updated instructions. Verified nested engine
  identity/version/host declaration, SHA-256 digest, shipped runtime/helper bytes,
  and exclusion of test files. Build command: `companion/package-windows.ps1`
  with `-EngineVsix` pointing to the separately built engine artifact. Only the
  resulting Windows VSIX is distributed.
- Installed Windows package 0.2.0 in real Default/cursor profiles. Existing active
  windows may require reload, and upgrading an already-active old engine can
  request a further normal VS Code reload. The engine may be listed separately
  internally; users no longer download or manually install a second product VSIX.
- Remote-SSH connectivity, workspace trust and installation policies remain normal
  prerequisites. No Marketplace access is needed to obtain the bundled engine.
  At the end of this validation run, the builds were uncommitted and unpublished;
  no push or merge had been performed.
