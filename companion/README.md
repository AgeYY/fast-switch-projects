# Single visible project window — Windows prototype

Keeps explicitly registered VS Code project windows alive and hides inactive ones.
Install this one Windows VSIX for both local and Remote-SSH workspaces. It includes
native window control and the project engine, and automatically sets up the engine
in the appropriate VS Code host. No separate engine download or installation is
needed. The default single-window setting is **off**.

Requirements: desktop VS Code on Windows; for SSH projects, Microsoft Remote-SSH
and a working connection. Trust your workspaces when prompted. VS Code may require
a reload when updating an already active engine. Installation policies still apply.
The bundled engine may appear as a separate internal extension in VS Code's
Extensions view; the user installs and updates only the Windows package.

## Try three projects

1. In a local Windows VS Code window, run **Extensions: Install from VSIX...**
   and select `fast-switch-projects-windows-0.2.0.vsix`. Automatic setup supplies
   the engine for local workspaces and each Remote-SSH host/profile you connect to.
   Reload when prompted after an update.
2. Add your projects to the Slots sidebar. Separate saved `.code-workspace` files
   can reference the same source folder while keeping independent sessions.
3. Run **Fast Switch Projects: Open and Register All Listed Projects**. This
   explicitly approves exactly the listed workspace identities, opens them, and
   waits up to a minute for their companions to register native windows. Trust
   your workspaces if prompted. Startup/trust delays are reported as pending;
   approved windows register when ready, even after that wait ends.
4. Run **Fast Switch Projects: Enable Single Visible Window Mode** in the desired
   active project window. Registration alone leaves hiding paused.
5. Use the existing project sidebar and slot shortcuts.

Approval persists in this Windows profile per workspace URI, including SSH host.
Unlisted windows are not approved. **Unregister This Project Window** persists a
revocation, including after reopening; running bulk registration again explicitly
approves listed projects again. Cancellation stops additional opens; approvals
already saved for the selected list persist. Windows missing trust or the updated
companion cannot register until those prerequisites are satisfied.

You can still register one window with **Register This Project Window**. Opening
another workspace does not register it implicitly. The prototype does not close
windows or terminate terminals/processes.

## Recovery

- **Fast Switch Projects: Show All Project Windows** restores hidden windows and
  pauses hiding. Run **Enable Single Visible Window Mode** to resume.
- Turning `fastSwitchProjects.singleWindow.enabled` off restores hidden windows.
  This is a local application setting shared by windows using that profile.
- A separate watchdog restores windows after a helper crash (checks every second).
  A hung helper is stopped after approximately 15 seconds without progress.
- A missing companion heartbeat restores windows after approximately 12 seconds.
- Closing the active window restores the remaining managed windows and pauses hiding.
- An independent recovery executable is available if VS Code cannot run commands:

  ```powershell
  & '<installed-companion>\bin\FspWindows.exe' recover '<companion-global-storage>\windows.json'
  ```

  The default storage is usually
  `%APPDATA%\Code\User\globalStorage\zeyuanye.fast-switch-projects-windows`.
  Profiles and alternate user-data directories change that location. The fallback
  stops only the broker recorded in that journal, checked against PID, start time
  and executable name, before restoring the recorded windows.

## Identity and switching

The saved workspace URI (including SSH authority) is the project identity. Two
workspace files referencing identical folders remain separate projects. A project
label change does not change the URI.

VS Code's stable API does not expose a native HWND. Registration temporarily
appends a random challenge to `window.title`, identifies exactly one `Code.exe`
window with the expected native class, then binds the HWND/PID to a random Win32
window property. Subsequent operations validate that property and PID, not titles.
The workspace title setting is restored in `finally`; a persisted recovery record
also restores it on the next activation after interruption. Registration can leave
an empty settings container in a folder/workspace that originally had none.

The broker transfers native window placement, shows the destination, and requests
foreground focus. If Windows denies focus, the companion asks VS Code to focus its
existing workspace through `vscode.openFolder` with `forceNewWindow: true`, then
requires native confirmation before hiding anything. Errors restore all managed
windows. A journal is written **before** each hide transaction.

Named-pipe access is restricted to the current Windows user. A per-storage mutex
and serialized requests coordinate all local extension hosts. Only registered
handles are managed. The helper supports stable VS Code `Code.exe`, not Insiders,
Cursor, web VS Code, or other applications.

## Current limits

- Live three-project local and Remote-SSH switching, editor/terminal/process
  retention, close/reopen, and helper recovery passed. The user confirmed local
  taskbar/Alt+Tab exclusion. Real maximization, cross-monitor/mixed-DPI and physical
  sidebar/shortcut checks remain outstanding; see the source validation record.
- Cold opens wait up to 30 seconds for an already-approved destination to register.
  An unapproved or slower destination remains visible alongside the source until
  explicitly registered/switched. No source window is replaced.
- Recovery intentionally pauses hiding even if the setting remains true.
- Mixed DPI, disconnected monitors, modal dialogs, foreground-lock conditions and
  application unresponsiveness need further testing. Modal/failed-focus switches
  are designed to restore windows rather than force the hide.
- Memory consumption remains that of the running project windows.

## Build and checks

On Windows, from `companion/`:

```powershell
npm.cmd run build
npm.cmd test
# First build/package the main project engine, then bundle that VSIX:
.\package-windows.ps1 -EngineVsix ..\prototype\results\fast-switch-projects-engine-1.5.4.vsix
```

The build uses the Windows .NET Framework C# compiler; no .NET SDK is required.
The native integration fixture creates four synthetic Win32 windows, three
registered and one excluded. It is **not VS Code**, and its timings are not
VS Code switching benchmarks. Tests also cover title restoration, command queue
recovery, workspace identity and disabled-mode routing with mocked VS Code APIs.

## References

- [VS Code remote/local command routing](https://code.visualstudio.com/api/advanced-topics/remote-extensions#communicating-between-extensions-using-commands)
- [VS Code openFolder command](https://code.visualstudio.com/api/references/commands#commands)
- [ShowWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-showwindow)
- [Foreground restrictions](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setforegroundwindow)

See `prototype/VALIDATION.md` in the source checkout for the exact test record.
