# Browser smoke test (throwaway)

Proves the Phase 1 exit criterion from `docs/platform-release-plan.md`:
`@pdf-book-splitter/core`'s `splitPdfBySize` runs unmodified in a browser,
using zero Node APIs, with no server upload of the PDF.

This is scaffolding to de-risk the plan, not a shipped product — it isn't
wired into the root `build`/`test`/`lint` scripts. Delete this directory
once Phase 2's real shared UI exists.

## Run it

```
npm install
npm run dev
```

Open the printed local URL, choose a PDF, and click Split — parts are
produced entirely client-side and offered as downloads.

```
npm run build
```

verifies the page also bundles cleanly (i.e. nothing in the core's main
entry point pulls in a Node-only import that a browser bundler can't
resolve).
