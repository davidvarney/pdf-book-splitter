# Cross-Platform Release Plan

Target platforms: **macOS, Windows, Linux (Ubuntu, Fedora), iOS, Android.**

This plan sequences the work so that every phase ships something real and
de-risks the next one, instead of front-loading a big rewrite before any
non-CLI user can touch the tool.

## Guiding principles

1. **One core, many shells.** `pdf-lib` (already the only PDF dependency)
   is pure JavaScript with no native bindings, and the splitting logic in
   `src/` (`split.ts`, `pageRanges.ts`, `size.ts`, `naming.ts`, `batch.ts`,
   `csvBatch.ts`) already contains no Node-only assumptions beyond how
   files are read/written. That means the *same* core can run in Node
   (CLI, Electron/Tauri backends), and in a browser/WebView (desktop
   webviews, iOS/Android via Capacitor) with no rewrite — only the I/O
   boundary needs to become pluggable. This is the single decision the
   rest of the plan leans on.
2. **Desktop before mobile.** Desktop shells reuse the Node ecosystem
   directly and have no app-store review process, so they're the fastest
   way to get a real GUI in front of users and shake out UI/UX questions.
   Mobile is left until the shared UI has already been validated on
   desktop.
3. **One native-shell technology per class of platform**, not five
   separate apps. Desktop = one Tauri project targeting macOS/Windows/
   Linux. Mobile = one Capacitor project targeting iOS/Android. Both wrap
   the same shared web UI and core package.
4. **The CLI keeps shipping.** It's already the most-tested surface and
   the automation-friendly one (CSV batch mode, scripting). It stays
   published to npm throughout, and stays the reference implementation
   the GUIs are checked against.
5. **Every phase ends with something installable/usable**, even if rough,
   so feedback arrives before the next phase is built on top of it.

## Architecture decision: Tauri + Capacitor over one shared web UI

| Option | Verdict |
|---|---|
| **Electron** (desktop) | Rejected as primary. Reuses Node directly (easiest short-term), but ships a full Chromium+Node per app (~150-200MB), and doesn't help mobile at all. |
| **Tauri** (desktop) | **Chosen.** Uses the OS's native webview (WebView2 on Windows, WebKit on macOS/Linux), so installers are small (~10-20MB). The core package runs as plain JS inside that webview — no Node required at runtime — so the exact same JS bundle used for the web UI runs unmodified. Rust is only glue (native file dialogs, packaging), not a rewrite target. |
| **React Native** (mobile) | Rejected as primary. Would require re-implementing the UI (and likely wrapping the JS core via a bridge) in a second UI framework, doubling UI maintenance. |
| **Capacitor** (mobile) | **Chosen.** Wraps the *same* web UI + core bundle built for Tauri in a thin native shell, adding native plugins only for what the web can't do (file picking via SAF/Files app, share sheet). Maximizes reuse with desktop. |
| **Flutter** | Rejected. Would mean rewriting the splitting core in Dart or bridging to it, discarding the "one core" principle for no offsetting benefit here. |

Net effect: there is **one core package** and **one UI codebase**, wrapped
by two thin native shells (Tauri, Capacitor) plus the existing CLI. This is
what makes the plan below "iterative" rather than five parallel rewrites.

## Phase 0 — Baseline (done)

- Node/TypeScript CLI, `pdf-lib`-based splitting engine, unit tests,
  ESLint, GitHub Actions CI (lint/typecheck/test on PR).
- Published as an npm package (`pdf-book-splitter`) for CLI users on any
  OS with Node 22.13+. This already covers macOS/Windows/Linux for
  terminal users and is the fallback distribution channel if a native app
  slips.

## Phase 1 — Extract the platform-agnostic core

**Goal:** make the splitting logic runnable outside Node without changing
its behavior, and prove it in a browser.

- Introduce a small I/O boundary (`readFile`, `writeFile`, `listDir`-style
  interface) that `split.ts`/`batch.ts` call through, instead of calling
  `node:fs` directly. Implement it once for Node (used by the CLI,
  unchanged behavior) and once backed by `ArrayBuffer`/`Blob` (used by the
  browser/webview shells).
- Move the engine into a workspace package (e.g. `packages/core`) that has
  zero Node-specific imports at its top level; the CLI becomes a consumer
  of it, same as future GUIs.
- Exit criteria: existing test suite passes unchanged against the
  refactored core; a throwaway browser smoke test (e.g. a Vite page that
  loads a PDF via `<input type=file>` and runs the size-based split
  client-side) proves the core works with zero Node APIs available.
- Risk to watch: `pdf-lib` holds the whole PDF in memory — fine for a CLI,
  but worth benchmarking against a large (500+ page, 500MB+) book early,
  since this same constraint follows into every GUI shell, especially
  mobile in Phase 6/7.

## Phase 2 — Shared web UI (dogfooded as a plain web app first)

**Goal:** one UI codebase that every native shell will wrap, validated as
a standalone site before any packaging complexity is added.

- Build the UI (drag-and-drop or file-picker input, size vs. page-range
  mode, directory/batch mode, progress and results list) against the
  Phase 1 core, using the browser I/O adapter.
- Ship it as a real, deployed static site (author's own use = the first
  "release"), even before any desktop/mobile wrapper exists. This is the
  cheapest possible way to get UI/UX feedback.
- Exit criteria: someone who has never used the CLI can split a book by
  size and by page range through the UI alone, entirely client-side (no
  server upload of the PDF).

## Phase 3 — macOS desktop app (Tauri)

**Goal:** first native, installable app, on the platform development
already happens on.

- Wrap the Phase 2 UI in Tauri; add native file-open/save dialogs and a
  native menu bar in place of the browser's `<input type=file>`.
- Code-sign and notarize (requires an Apple Developer Program
  enrollment — $99/yr) so Gatekeeper doesn't block first launch.
- Distribute as a `.dmg` from GitHub Releases; a Homebrew cask can follow
  once the app is stable.
- Exit criteria: a signed, notarized `.dmg` that installs and runs on a
  clean macOS machine without warnings.

## Phase 4 — Windows desktop app (same Tauri project)

**Goal:** add the Windows target to the already-working Tauri project.

- Build and test on Windows (VM or CI runner); Tauri uses WebView2, which
  ships with modern Windows but needs the redistributable bootstrapped on
  older images.
- Code-sign the installer (`.msi`/NSIS) — an EV or standard code-signing
  certificate avoids SmartScreen warnings; budget for this (~$100-400/yr,
  or a cheaper option like a Certum/SignPath-issued cert).
- Exit criteria: installer runs on a clean Windows 10/11 VM without
  SmartScreen blocking it outright.

## Phase 5 — Linux desktop app (Ubuntu, Fedora)

**Goal:** cover both requested distros without maintaining two packaging
pipelines long-term.

- Ubuntu: `.deb` via Tauri's bundler.
- Fedora: `.rpm` via Tauri's bundler.
- Evaluate a single Flatpak build as the longer-term answer for both
  (sandboxed, distro-version-independent) once `.deb`/`.rpm` prove the app
  works; keep `.deb`/`.rpm` as the initial, faster path.
- Exit criteria: package installs and runs on a clean Ubuntu LTS and a
  clean Fedora (current release) VM/container.

*(At the end of Phase 5, one Tauri project covers all three desktop
platforms — this is the point where "iterative" pays off: three platforms,
one shell codebase, mostly packaging/signing work per OS rather than new
app code.)*

## Phase 6 — iOS app (Capacitor)

**Goal:** reuse the same UI/core inside a native iOS shell.

- Wrap the Phase 2 UI in Capacitor; replace the browser file input with
  the iOS document picker / Files app integration (Capacitor Filesystem +
  a document-picker plugin) so users can pick a PDF from Files/iCloud and
  save results back out.
- Re-run the Phase 1 large-file memory benchmark specifically on-device —
  iOS WebViews have tighter memory ceilings than desktop, and this is the
  most likely place the "hold the whole PDF in memory" assumption from
  Phase 1 breaks first.
- Requires an Apple Developer Program enrollment (shared with Phase 3's
  notarization account) and a TestFlight beta round before any public
  submission.
- Exit criteria: TestFlight build where a tester can split a real book on
  a physical device; then App Store submission.

## Phase 7 — Android app (same Capacitor project)

**Goal:** add the Android target to the already-working Capacitor project.

- Replace file access with the Storage Access Framework via Capacitor's
  filesystem plugin; handle Android's broader device/OS-version spread in
  testing (older WebView versions in particular).
- Google Play Console enrollment ($25 one-time); start on the internal
  testing track before production.
- Exit criteria: internal-testing build where a tester can split a real
  book on a physical device; then Play Store submission.

## Cross-cutting work (build out alongside the phases above, not after)

- **Repository structure: one repo.** Every target platform is reachable
  from GitHub's three native OS runners, so the "one core, many shells"
  layout (`packages/core`, `apps/cli`, `apps/desktop` (Tauri),
  `apps/mobile` (Capacitor), as npm/Cargo workspaces in this repo) doesn't
  need to split across repos to build:

  | Runner | Builds |
  |---|---|
  | `macos-latest` | macOS `.dmg` (Tauri) **and** iOS `.ipa` (Capacitor/Xcode) — both need a real macOS+Xcode host |
  | `windows-latest` | Windows installer (Tauri/WebView2) |
  | `ubuntu-latest` | Linux `.deb` **and** `.rpm` (Tauri — `rpmbuild` installs via `apt`, no dedicated Fedora runner needed) **and** Android `.aab`/`.apk` (Capacitor/Gradle) |
  | any runner | CLI → npm publish |

  Tauri specifically wants to build on the actual target OS (it links
  against that OS's native webview), which is why this matrix maps 1:1 to
  GitHub's three native runner families with no cross-compilation. A
  second repo would only make sense for independent release cadence per
  platform or stricter secret isolation than GitHub's per-environment
  encrypted secrets already provide — neither applies at this project's
  size.
- **CI/CD:** extend the existing GitHub Actions setup so each tagged
  release runs the matrix above in one workflow, builds the npm package,
  Tauri bundles for macOS/Windows/Linux, and (once Phases 6-7 exist) the
  Capacitor builds — one release pipeline producing every artifact per
  version tag (plus separate fastlane/App Store Connect API and Google
  Play Developer API steps for the two store submissions, since those
  need signed uploads rather than a plain release artifact), rather than
  five manual release processes.
- **Auto-update:** Tauri's built-in updater for desktop once Phase 3 is
  stable, so macOS/Windows/Linux users aren't stuck manually redownloading
  installers each release.
- **Versioning:** keep the core, CLI, and all shells on one version number
  per release so "does bug X exist in the app" maps directly to a CLI
  version people can already reproduce against.
- **Telemetry-free by default:** given the tool processes personal PDFs
  entirely client-side today (no server upload), preserve that property
  through every shell — it's a real selling point worth not accidentally
  regressing when adding native file APIs.

## Open decisions before starting Phase 1

- App/bundle identifier and product name to reserve across the Apple
  Developer Program, Google Play Console, and Windows code-signing cert
  (all three should match to avoid re-doing enrollment work later).
- Budget/appetite for the paid enrollments: Apple Developer Program
  ($99/yr), Google Play Console ($25 one-time), Windows code-signing cert
  (~$100-400/yr). None of these block Phases 1-2.
- Whether the web UI from Phase 2 is also kept as a permanently-hosted
  public site (a "try it in your browser" option) or only used
  internally as a build target for the native shells.
