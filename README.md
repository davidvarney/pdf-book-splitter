# pdf-book-splitter

Splits a PDF book into multiple PDF files, each no larger than a size you
choose, without ever damaging a page (a page is always kept whole — it's
never split across files, re-rendered, or re-compressed).

## How splitting works

There are two ways to choose where a book breaks into files:

- **By size** (the default): pages are packed greedily, in order, into the
  current output file until the next page would push it over your
  requested size limit. Files are **never** larger than the size you asked
  for, with one unavoidable exception: if a single page's own serialized
  size already exceeds your limit (e.g. one page with a huge embedded
  image), that page is still kept whole as its own file, and the tool
  prints a warning — a page is never damaged just to force it under the
  limit. The book isn't forced into equal-sized chunks: each file is
  packed as full as possible up to the limit, and whatever pages are left
  over at the end become the last, typically smaller, file.
- **By specific pages**: you choose exactly which pages to split after
  (e.g. "50,120"), and no size limit is applied — you're taking full
  manual control of where the book breaks.

In every case, a page is always kept whole — never split across files,
re-rendered, or re-compressed.

## Output naming

Files are named `<book-name>_partNN_of_TT.pdf`, e.g.:

```
my-book_part01_of_12.pdf
my-book_part02_of_12.pdf
...
my-book_part12_of_12.pdf
```

The part number is zero-padded so files always sort — alphabetically and
numerically — in the order they should be read.

## Repository structure

This is an npm workspace with the splitting engine and the CLI in separate
packages, so the same engine can be reused by future desktop/mobile shells
without a rewrite (see `docs/platform-release-plan.md`):

- `packages/core` — the platform-agnostic splitting engine (`@pdf-book-splitter/core`).
  Its main entry point has no Node-only imports; a Node-backed directory-scan
  and CSV-batch adapter lives at the `@pdf-book-splitter/core/node` subpath
  for hosts (like the CLI) that need it.
- `apps/cli` — the `pdf-book-splitter` CLI, a thin Commander wrapper around
  `packages/core`.
- `apps/web` — the shared web UI (`@pdf-book-splitter/web`, React + Vite),
  splitting PDFs entirely client-side against `packages/core`'s browser
  entry point, with no server upload. This is the same UI the Tauri
  (desktop) and Capacitor (mobile) shells wrap in later phases. When
  running inside Tauri, `apps/web/src/lib/platform.ts` swaps the browser's
  `<input type=file>`/download-link flow for native open/save dialogs; a
  plain browser build never loads that code path.
- `apps/desktop` (`@pdf-book-splitter/desktop`) — the macOS/Windows/Linux
  desktop app: a Tauri shell (`src-tauri/`, Rust) wrapping `apps/web`
  unmodified, adding native file-open/save dialogs and a native menu bar.
- `examples/browser-smoke` — a throwaway page proving the core runs in a
  browser with zero Node APIs; not part of the published package.

## Install / build

Requires Node.js 22.13+ (the version needed by this project's test tooling).

```
npm install
npm run build
```

## Usage

### Split a single file

```
node apps/cli/dist/cli.js split <input.pdf> (--size <size> | --split-at <pages>) [--out <dir>]
```

- `<input.pdf>` — path to the source PDF.
- `--size, -s` — max size per output file, e.g. `50MB`, `700KB`, `1GB`, or a
  raw byte count. Mutually exclusive with `--split-at`.
- `--split-at, -p` — split at specific pages instead of by size, e.g.
  `"50,120,180"` (a comma-separated list of pages to split *after*). On a
  200-page file, `--split-at 50,120` produces parts covering pages 1-50,
  51-120, and 121-200. No size limit applies in this mode.
- `--out, -o` — output directory (default: a new folder named after the
  input file, e.g. `my-novel/`, created next to it).

```
node apps/cli/dist/cli.js split ~/Books/my-novel.pdf --size 25MB
```

```
Splitting "/Users/you/Books/my-novel.pdf" into parts no larger than 25.0 MB...
  my-novel_part01_of_04.pdf  (pages 1-140, 25.0 MB)
  my-novel_part02_of_04.pdf  (pages 141-283, 24.9 MB)
  my-novel_part03_of_04.pdf  (pages 284-426, 25.0 MB)
  my-novel_part04_of_04.pdf  (pages 427-501, 14.2 MB)

Done. Wrote 4 file(s) to "/Users/you/Books/my-novel".
```

```
node apps/cli/dist/cli.js split ~/Books/my-novel.pdf --split-at 140,283,426
```

```
  my-novel_part01_of_04.pdf  (pages 1-140, 24.8 MB)
  my-novel_part02_of_04.pdf  (pages 141-283, 25.3 MB)
  my-novel_part03_of_04.pdf  (pages 284-426, 24.6 MB)
  my-novel_part04_of_04.pdf  (pages 427-501, 14.2 MB)

Wrote 4 file(s) to "/Users/you/Books/my-novel".
```

### Split every oversized PDF in a directory

```
node apps/cli/dist/cli.js split --dir <directory> --size <size> [--threshold <size>] [--interactive] [--out <dir>]
```

- `--dir, -d` — a directory to scan instead of a single file. Only the
  PDFs directly inside it are scanned (not subdirectories), so re-running
  the command won't try to re-split files in the output folders it already
  created.
- `--size, -s` — still required: the max size per output file for anything
  that does get split by size (see `--interactive` below).
- `--threshold, -t` — only files larger than this get split; everything
  else is left untouched. Defaults to the same value as `--size` (i.e.
  "split anything that wouldn't already fit").
- `--interactive, -i` — before splitting each oversized file, ask for page
  numbers to split at (same format as `--split-at`); press Enter at the
  prompt to fall back to the automatic, size-based split for that file
  instead. Without this flag, every oversized file is split by size with
  no prompts at all.
- `--out, -o` — root output directory. Each source file that gets split
  still gets its own folder named after it, created under this root
  (default: next to the original file, same as single-file mode).

```
node apps/cli/dist/cli.js split --dir ~/Books --size 25MB
```

```
Found 6 PDF file(s) in "/Users/you/Books". Splitting 2 file(s) larger than 25.0 MB, skipping 4.

Skipping "short-story.pdf" (3.1 MB, at or under the threshold).
...

Splitting "my-novel.pdf" (89.4 MB)...
  my-novel_part01_of_04.pdf  (pages 1-140, 25.0 MB)
  ...
  Wrote 4 file(s) to "/Users/you/Books/my-novel".

Done. Split 2 file(s), skipped 4 file(s).
```

Add `--interactive` to be asked for page numbers before each oversized file
is split, instead of always splitting by size:

```
node apps/cli/dist/cli.js split --dir ~/Books --size 25MB --interactive
```

```
Splitting "my-novel.pdf" (89.4 MB)...
  "my-novel.pdf" has 501 pages. Enter page numbers to split after (e.g. "50,120"), or press Enter to split automatically into 25.0 MB parts: 140,283,426
  my-novel_part01_of_04.pdf  (pages 1-140, 24.8 MB)
  ...
```

### Batch-process a list of files from a CSV

For a specific, hand-picked list of files (rather than everything in a
folder), describe the batch as a CSV and let the tool process it in one
go. Generate a template first so the format is never guesswork:

```
node apps/cli/dist/cli.js split --csv-template [path]
```

Writes a commented template CSV (default: `pdf-book-splitter-template.csv`
in the current directory) and exits without processing anything. It
refuses to overwrite a file that already exists there, so it's safe to run
even if you're not sure what's already at that path. Fill in the template,
then run:

```
node apps/cli/dist/cli.js split --csv <file> [--out <dir>]
```

- `--csv, -c` — path to the batch CSV. Mutually exclusive with a positional
  input file and with `--dir`.
- `--out, -o` — root output directory (optional). Same role as in
  directory mode: each file's parts still land in their own folder named
  after it, created under this root instead of next to the original file.

The CSV has four columns:

| Column      | Required? | Meaning |
|-------------|-----------|---------|
| `input`     | yes       | Path to the PDF. Relative paths are resolved relative to **the CSV file's own location**, not the current directory. |
| `size`      | one of `size`/`split_at` | Max size per output file for this row, e.g. `25MB`. |
| `split_at`  | one of `size`/`split_at` | Page numbers to split after for this row, e.g. `"50,120,180"` — quote it, since it contains commas. |
| `out`       | no        | Output directory for this row's parts (also resolved relative to the CSV file). Falls back to `--out` if given, otherwise next to the input file. |

Every row is validated — file exists, exactly one of `size`/`split_at` is
given and is well-formed — **before** anything is split, and every problem
found is reported together in one error, not one row at a time.

```
node apps/cli/dist/cli.js split --csv-template ./books/batch.csv
# edit ./books/batch.csv, then:
node apps/cli/dist/cli.js split --csv ./books/batch.csv
```

```
Processing 3 file(s) listed in "/Users/you/books/batch.csv"...

Row 1: splitting "my-novel.pdf"...
  my-novel_part01_of_04.pdf  (pages 1-140, 25.0 MB)
  ...
  Wrote 4 file(s) to "/Users/you/books/my-novel".

Row 2: splitting "my-textbook.pdf"...
  ...

Done. Split 3 file(s) listed in "/Users/you/books/batch.csv".
```

Once installed globally or linked, the same commands work as
`pdf-book-splitter split ...`. Run `node apps/cli/dist/cli.js split --help` (or
`pdf-book-splitter split --help`) for the full option reference and more
examples.

## Web UI

```
npm run dev:web      # start the web UI's dev server (apps/web)
```

Open a PDF via drag-and-drop or the file picker, choose size- or
page-range-based splitting (or select multiple files for batch mode), and
download the resulting parts — everything runs in your browser, with no
PDF ever uploaded to a server.

Every push to `main` that touches `apps/web` or `packages/core` rebuilds
and redeploys it to GitHub Pages (`.github/workflows/deploy-web.yml`),
once Pages is enabled for this repository under Settings > Pages
("Source: GitHub Actions").

## Desktop app (macOS/Windows/Linux)

Requires the [Rust toolchain](https://rustup.rs) in addition to Node, plus
the platform's native webview dependencies (already present on macOS via
Xcode Command Line Tools; see the
[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for
Windows/Linux).

```
npm run dev:desktop     # launch the app against a live dev server
npm run build:desktop   # produce a release .app/.dmg (macOS) at
                         # apps/desktop/src-tauri/target/release/bundle/
```

`apps/desktop` wraps `apps/web` unmodified in Tauri, so it's the same UI,
plus native open/save dialogs and a native menu bar (File > Open PDF...)
in place of the browser's `<input type=file>`. A release build here is
currently **ad-hoc signed only** — code-signing and notarization (so
Gatekeeper doesn't warn on first launch) need an Apple Developer Program
account, which isn't wired into the build yet.

## Development

```
npm run test        # run the test suite once
npm run test:watch  # watch mode
npm run typecheck   # type-check without emitting
npm run lint        # lint with ESLint
npm run lint:fix    # lint and auto-fix what it can
```

A GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every pull
request (on open and on each new push to it), across the Node versions this
project supports. Lint, typecheck, and test each run as their own separate
job, so a failure in one shows up as its own check on the PR instead of
being buried in shared step logs.

## Roadmap

The CLI, the platform-agnostic core, and the shared web UI are done; the
macOS desktop app in `apps/desktop` is the current milestone, pending
Apple Developer Program code-signing/notarization. Windows and Linux
targets reuse the same Tauri project next, then iOS/Android wrap the same
web UI again via Capacitor — see `docs/platform-release-plan.md` for the
full phase-by-phase plan.
