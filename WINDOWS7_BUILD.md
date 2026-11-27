# Building Blockbench for Windows 7 SP1 (64-bit)

This branch builds Blockbench 5.2.2 so it **runs and installs on Windows 7
Service Pack 1 x64** (tested target: Windows 7 Ultimate SP1, build 7601).

Electron 22.3.27 is the last Electron that starts on Windows 7, so the whole
toolchain is pinned to it: Chromium 108, Node 16.16 inside the app, and
`target: 'chrome108'` in `build.mjs`.

---

## Requirements (build machine)

Node.js 16 or newer (18 LTS is fine) and npm. NSIS is **not** required — it
ships inside `electron-builder` (`app-builder-bin`).

```bash
npm install
```

`npm install` downloads the Electron 22 binaries, so it needs network access
the first time.

---

## Build the installer

### Option A: let GitHub build it (no local setup)

`.github/workflows/build-windows7.yml` builds the installer on a Windows
runner and uploads it as an artifact.

1. Push a commit whose message contains `ci-build` (the convention
   `build-linux.yml` already uses), or run the workflow by hand:
   *Actions → Build Windows 7 installer → Run workflow*.
2. When the run finishes, download **blockbench-win7-x64-installer** from the
   run's *Artifacts* section.

Pushing a `v*` tag also publishes a GitHub release with the installer
attached. The build is **unsigned**, so Windows SmartScreen will warn on the
target machine until a certificate is configured.

### Option B: build locally on Windows

```bash
npm install
npm run build-electron     # esbuild desktop bundle + IIFE check + index.html
npx electron-builder --win nsis --x64 --publish=never
```

The result lands in `dist-electron/`:

```
dist-electron/Blockbench_win7_x64_5.2.2.exe
```

`npm run build-test-portable` produces an unsigned portable `.exe` instead,
which is handy for a quick check without installing.

Building the installer does **not** need a code signing certificate. If you do
have one, set `CSC_LINK` / `CSC_KEY_PASSWORD` (or install the certificate in
the Windows certificate store) and add the subject back to `build.win`:

```json
"win": {
  "certificateSubjectName": "Your Certificate Subject"
}
```

> Do **not** add `certificateSubjectName` without having that certificate
> available: `electron-builder` then fails while looking up the certificate,
> before it ever gets to NSIS.

---

## What was fixed for Windows 7

### Installer: "Unspecified error" when starting Blockbench

The stock electron-builder flow fails on Windows 7 in two places, both with an
error dialog titled after the shortcut path
(`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Blockbench.lnk`):

1. **Finish page → "Run Blockbench".** The template runs
   `StdUtils::ExecShellAsUser` on the `.lnk`. That is
   `IShellDispatch2::ShellExecute` with the verb `"open"`, and for link files
   the shell requires both the verb and the class name to be `NULL`. On
   Windows 7 the call fails with `E_FAIL`, which Explorer shows as
   "Unspecified error".
2. **Start Menu → Blockbench.** The template stamps the shortcut with
   `WinShell::SetLnkAUMI`. That AppUserModelID property is not honoured by
   Windows 7, and Explorer can no longer resolve the link.

`build/installer.nsh` fixes both:

| Hook | What it does |
| --- | --- |
| `customFinishPage` | Replaces the Finish page and starts `$INSTDIR\Blockbench.exe` directly, no shell and no `.lnk`. Falls back to the link only if the exe is missing. |
| `customInstall` | Recreates the Start Menu link (and an existing desktop link), which drops the stale AUMI property, then writes the AppUserModelID only on Windows 8+. |
| `customInit` | Stops on 32-bit Windows; warns (asks) on Windows older than 7 SP1. Silent installs are never blocked by a dialog. |

`StartApp` from the template is left untouched, so silent
`--force-run` installs keep working.

### App startup

`js/lib/libs.ts` re-exports the `VuePrismEditor` UMD bundle onto `window`.
Inside an esbuild bundle the `exports`/`module` shim always exists, so the
library took its CommonJS branch and never assigned the global — startup
crashed with `VuePrismEditor is not defined`.

### CSS

`color-mix()` only exists from Chromium 111 on, and this build renders with
Chromium 108. Every `color-mix()` declaration now has an `rgba()` fallback in
front of it (`css/dialogs.css`, `css/general.css`, `css/panels.css`).

---

## Browser preview

`npm run build-electron` rewrites `index.html` to load the Electron bundle,
which cannot run in a normal browser (`Dynamic require of "fs" is not
supported`). To go back to a browsable build:

```bash
npm run preview          # http://localhost:8811
```

`npm run preview` switches `index.html` back to `dist/bundle.js`, rebuilds it
if any source file is newer, and serves the folder. `npm run build-web` only
does the build, without the server.

---

## Verification status

Checked in this repository:

- **Chromium 108** (the engine Electron 22 ships): app starts, reports
  `5.2.2`, `newProject('free')` works, a cube renders through WebGL2 at
  ~56 FPS, outliner/UV/textures panels all populate.
- **NSIS script**: `build/installer.nsh` is compile-checked against NSIS 3.04
  headers (LogicLib, WinVer, x64) with all three hooks expanded and asserted
  (`.arena/nsistest/validate.nsi`). It is not exercised end to end, because
  this environment cannot produce a real installer executable.
- **electron-builder config**: validates against the `app-builder-lib` 23.6.0
  schema.

- **GitHub Actions**, `windows-latest`: the installer compiles with the real
  electron-builder NSIS plugin set (StdUtils, WinShell, UAC, nsProcess) and is
  produced as a ~76 MB artifact. This proves `build/installer.nsh` builds, not
  that it behaves.

Not verified here, needs a real Windows 7 SP1 x64 machine:

- The installer running to completion and the Finish-page launch.
- Double-clicking the installed Start Menu shortcut.
- GPU/driver behaviour on the target hardware (Core 2 Duo E8400, 2 GB RAM).

---

## Troubleshooting on the target machine

- **The installer still shows the old error.** It was built from a commit
  before `build/installer.nsh` existed. Rebuild and check that
  `dist-electron/Blockbench_win7_x64_5.2.2.exe` has today's date.
- **App starts but the window stays black.** Run it once with
  `Blockbench.exe --disable-gpu` or disable *Settings → Hardware acceleration*
  (stored in `%APPDATA%\Blockbench\launch_settings.json`).
- **`reg query "HKCR\lnkfile" /v IsShortcut`** must report `IsShortcut`.
  If the value is missing, no shortcut on that system can be started and the
  problem is outside Blockbench (usually malware or a "PC optimizer" that
  deleted it).
