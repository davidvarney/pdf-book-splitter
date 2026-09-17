# Apple Developer Certificate Setup (macOS signing & notarization)

This is the exact process to get a working Apple Developer certificate and
wire it into the Tauri desktop build at
[apps/desktop/src-tauri/tauri.conf.json](../apps/desktop/src-tauri/tauri.conf.json),
which currently bundles `dmg`/`app` targets with no signing configured.

## 1. Enroll in the Apple Developer Program

- Go to developer.apple.com/programs and sign in with (or create) an Apple ID.
- Choose **Individual** ($99/yr, enrolls under your legal name) or
  **Organization** (needs a D-U-N-S number, legal entity binding authority).
  For a solo project like this, Individual is simpler.
- Apple verifies your identity — for Individual this is usually automatic or
  a quick check; Organization can take days (D-U-N-S lookup/registration).
- Payment renews annually; if it lapses, existing signed apps keep working
  but you can't re-sign/notarize new builds.

## 2. Generate a Certificate Signing Request (CSR)

On your Mac:
- Open **Keychain Access** → menu **Keychain Access → Certificate Assistant
  → Request a Certificate From a Certificate Authority**.
- Enter your email, your name, select **Saved to disk**, leave CA email
  blank.
- This creates a `.certSigningRequest` file and a matching private key in
  your login keychain — don't delete that key, it's what makes the cert
  usable.

## 3. Create the certificate in the Developer portal

- Go to developer.apple.com/account → **Certificates, Identifiers &
  Profiles** → **Certificates** → **+**.
- For a Tauri app distributed *outside* the Mac App Store (which is what
  `"targets": ["dmg", "app"]` implies), pick **Developer ID Application**.
  (If you ever target the Mac App Store instead, you'd need **Apple
  Distribution** + a provisioning profile instead.)
- Upload the `.certSigningRequest` from step 2.
- Download the resulting `.cer` file, double-click it to install into
  Keychain Access (it pairs with the private key already there).

## 4. Export a `.p12` for CI / build use

- In Keychain Access, find the new cert under **My Certificates**, expand
  it to confirm the private key is nested under it.
- Right-click the certificate (not just the key) → **Export "Developer ID
  Application: Your Name (TEAMID)..."** → save as `.p12`, set a password.
- Base64-encode it if you'll store it as a CI secret:
  `base64 -i cert.p12 | pbcopy`.

## 5. Wire it into the Tauri build

Tauri's signing config lives in env vars, not `tauri.conf.json`, for
`tauri build`:

```
APPLE_CERTIFICATE=<base64 .p12>
APPLE_CERTIFICATE_PASSWORD=<p12 password>
APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
```

For notarization (required — Gatekeeper blocks unnotarized apps on modern
macOS), add either:
- `APPLE_ID`, `APPLE_PASSWORD` (an **app-specific password** from
  appleid.apple.com, not your real Apple ID password), `APPLE_TEAM_ID`, or
- an App Store Connect API key: `APPLE_API_ISSUER`, `APPLE_API_KEY`,
  `APPLE_API_KEY_PATH` (downloaded from App Store Connect → Users and
  Access → Keys).

Your Team ID is on the developer portal membership page.

## 6. Build

```
npm run build -w apps/web && tauri build
```

With those env vars set, `tauri build` signs the `.app`/`.dmg`, submits for
notarization, and staples the ticket automatically.

## Still to do

- Add these env vars as GitHub Actions repo secrets and a signing step to
  the release workflow, once one exists.
- Decide whether to also enroll for Windows code signing (separate CA-issued
  cert, unrelated to Apple) before Phase 4 ships a Windows build.
