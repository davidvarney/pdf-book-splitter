# Windows Code Signing Setup

Phase 4 of [docs/platform-release-plan.md](platform-release-plan.md) adds the
Windows target to the existing Tauri project at
[apps/desktop/src-tauri](../apps/desktop/src-tauri). This is the process to
get an unsigned build running, then a signed one that doesn't trip Windows
SmartScreen.

## 1. Unsigned build first (unblocks testing immediately)

No certificate is required to build and run the app — SmartScreen only
affects *distribution* to other machines. To build locally on a Windows
machine or CI runner:

```
npm run build:desktop
```

`apps/desktop/src-tauri/tauri.conf.json` now sets `"bundle.targets": "all"`,
so on Windows this produces both an NSIS (`.exe`) and an MSI installer under
`apps/desktop/src-tauri/target/release/bundle/`. CI now runs this on
`windows-latest` in [.github/workflows/ci.yml](../.github/workflows/ci.yml)
(job `desktop-build-windows`), unsigned, on every PR — same pattern as the
existing macOS job. That job also silently installs both the MSI and the
NSIS installer (`msiexec /quiet` and `setup.exe /S`) and checks the app
registers an uninstall entry afterward, as an automated smoke test that the
installers don't just build but actually install without erroring. This is
a real Windows Server VM, not a container — see the note on why Windows
containers aren't a fit for this in the Phase 4 discussion.

An unsigned installer runs fine on a Windows 10/11 VM; SmartScreen shows an
"unrecognized app" warning ("More info" → "Run anyway") rather than an
outright block, since Tauri's installers are set up as normal Win32
installers, not files inheriting a browser-download mark-of-the-web block.
That warning is what a real code-signing cert removes.

## 2. Choose a certificate type

Two kinds of Windows code-signing cert:

| Type | Effect | Cost (approx.) |
|---|---|---|
| **Standard (OV) code signing cert** | Builds SmartScreen reputation over time (based on download volume) — early installs may still warn until enough people have run it. | ~$100-250/yr |
| **EV (Extended Validation) code signing cert** | Immediate SmartScreen trust, no reputation ramp-up. Since 2023 most CAs issue EV keys only on a hardware token (USB HSM) or cloud HSM — can't be exported as a plain `.pfx`. | ~$250-400/yr, or per-signature via a cloud signing service |

For a small, actively-downloaded indie app, EV is worth it to skip the
reputation-building period; if budget is the constraint, standard is fine
and just means early adopters see one extra click.

Vendors worth comparing: **Certum** (cheaper OV/EV, open-source-friendly
pricing), **SignPath.io** (free for qualifying OSS projects, cloud HSM
signing via CI — no local hardware token needed), **DigiCert**/**Sectigo**
(mainstream, pricier).

SignPath is the most CI-friendly option if this repo stays public/OSS: it
signs artifacts via an API call from GitHub Actions, no physical token to
manage.

## 3. Get the certificate

- **OV cert (software-based)**: CA verifies your identity/business (similar
  scope to Apple's Individual enrollment check), issues a `.pfx`/`.p12` you
  download directly.
- **EV cert (hardware/cloud-based)**: CA verifies identity, then either
  ships a USB token (must be plugged into the signing machine — awkward
  for CI) or provisions access to their cloud HSM (works fine from CI via
  API credentials).
- **SignPath free OSS tier**: apply with the GitHub repo URL; once
  approved, signing happens via their GitHub Action, no cert material
  touches this repo at all.

## 4. Wire it into the Tauri build

For a `.pfx`-based cert (standard OV path), Tauri's Windows signing reads
these env vars during `tauri build`:

```
TAURI_SIGNING_PRIVATE_KEY=<path or base64 of .pfx>
TAURI_SIGNING_PRIVATE_KEY_PASSWORD=<pfx password>
```

(These are for Tauri's *updater* signature. For Authenticode signing of the
`.exe`/`.msi` itself — the one SmartScreen checks — Tauri shells out to
`signtool.exe`, configured via `bundle.windows.certificateThumbprint` in
`tauri.conf.json` once the cert is installed in the Windows cert store, or
via `bundle.windows.signCommand` to call an external tool like SignPath's
CLI/action instead of `signtool`.)

For a cloud-HSM/EV or SignPath setup, signing typically happens as a
**separate CI step after `tauri build`**, signing the produced
`.exe`/`.msi` in place, rather than through Tauri's own signing config —
follow the specific vendor's GitHub Action.

## 5. Exit criteria (per the release plan)

Installer runs on a clean Windows 10/11 VM without SmartScreen blocking it
outright. Unsigned already clears the "not blocked outright" bar (just an
extra click); a cert removes the warning entirely (immediately for EV,
gradually for OV as download reputation builds).

## Still to do

- Pick a vendor (leaning SignPath if this repo stays public — free and
  CI-native) and enroll.
- Add the resulting signing step to a release workflow once one exists,
  parallel to the macOS notarization step in
  [docs/apple-developer-cert-setup.md](apple-developer-cert-setup.md).
- Confirm the SmartScreen warning itself (the click-through, not just a
  clean install) on a real interactive Windows 10/11 VM — CI's silent
  install proves the installer *works*, not what a real user sees on
  first double-click, since SmartScreen's cloud reputation check needs an
  interactive session.
