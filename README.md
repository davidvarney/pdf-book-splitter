# pdf-book-splitter

Splits a PDF book into multiple PDF files, each no larger than a size you
choose, without ever damaging a page (a page is always kept whole — it's
never split across files, re-rendered, or re-compressed).

## How splitting works

- Pages are packed greedily, in order, into the current output file until
  the next page would push it over your requested size limit.
- Files are **never** larger than the size you asked for, with one
  unavoidable exception: if a single page's own serialized size already
  exceeds your limit (e.g. one page with a huge embedded image), that page
  is still kept whole as its own file, and the tool prints a warning — a
  page is never damaged just to force it under the limit.
- The book isn't forced into equal-sized chunks. Each file is packed as
  full as possible up to the limit; whatever pages are left over at the end
  become the last, typically smaller, file.

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

## Install / build

Requires Node.js 22.13+ (the version needed by this project's test tooling).

```
npm install
npm run build
```

## Usage

### Split a single file

```
node dist/cli.js split <input.pdf> --size <size> [--out <dir>]
```

- `<input.pdf>` — path to the source PDF.
- `--size, -s` — max size per output file, e.g. `50MB`, `700KB`, `1GB`, or a
  raw byte count.
- `--out, -o` — output directory (default: a new folder named after the
  input file, e.g. `my-novel/`, created next to it).

```
node dist/cli.js split ~/Books/my-novel.pdf --size 25MB
```

```
Splitting "/Users/you/Books/my-novel.pdf" into parts no larger than 25.0 MB...
  my-novel_part01_of_04.pdf  (pages 1-140, 25.0 MB)
  my-novel_part02_of_04.pdf  (pages 141-283, 24.9 MB)
  my-novel_part03_of_04.pdf  (pages 284-426, 25.0 MB)
  my-novel_part04_of_04.pdf  (pages 427-501, 14.2 MB)

Done. Wrote 4 file(s) to "/Users/you/Books/my-novel".
```

### Split every oversized PDF in a directory

```
node dist/cli.js split --dir <directory> --size <size> [--threshold <size>] [--out <dir>]
```

- `--dir, -d` — a directory to scan instead of a single file. Only the
  PDFs directly inside it are scanned (not subdirectories), so re-running
  the command won't try to re-split files in the output folders it already
  created.
- `--size, -s` — still required: the max size per output file for anything
  that does get split.
- `--threshold, -t` — only files larger than this get split; everything
  else is left untouched. Defaults to the same value as `--size` (i.e.
  "split anything that wouldn't already fit").
- `--out, -o` — root output directory. Each source file that gets split
  still gets its own folder named after it, created under this root
  (default: next to the original file, same as single-file mode).

```
node dist/cli.js split --dir ~/Books --size 25MB
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

Once installed globally or linked, the same commands work as
`pdf-book-splitter split ...`. Run `node dist/cli.js split --help` (or
`pdf-book-splitter split --help`) for the full option reference and more
examples.

## Development

```
npm run test        # run the test suite once
npm run test:watch  # watch mode
npm run typecheck   # type-check without emitting
npm run lint        # lint with ESLint
npm run lint:fix    # lint and auto-fix what it can
```

A GitHub Actions workflow (`.github/workflows/ci.yml`) runs lint, typecheck,
and the test suite on every pull request (on open and on each new push to
it), across the Node versions this project supports.

## Roadmap

This CLI is the first milestone. The plan is to validate the core
splitting logic here, then build native front-ends on top of the same
approach for macOS, iOS, Linux (Ubuntu/Fedora), Android, and Windows.
