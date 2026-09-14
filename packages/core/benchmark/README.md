# Large-file benchmark

Checks the risk flagged in `docs/platform-release-plan.md` Phase 1: `pdf-lib`
holds the whole PDF in memory, which is fine for a CLI but needs measuring
against a large book before every future GUI shell (desktop, and especially
memory-constrained mobile WebViews in Phase 6/7) inherits the same
constraint. See `RESULTS.md` for the latest numbers and what they mean.

Not part of `build`/`test`/`lint` — this is a manual tool, run it again
whenever `split.ts`'s algorithm changes or before a memory-sensitive phase
(6/7) starts.

## Run it

```
npm run bench:generate -w packages/core -- [pageCount] [imageSidePx] [outPath]
npm run bench:run -w packages/core -- <path-to-pdf> [maxSize]
```

`bench:generate` defaults to a 550-page, ~600MB PDF (each page a unique
random-noise image, so pages can't dedupe a shared resource — a worst case
for memory, not a typical scanned book). `bench:run` defaults to splitting
into 25MB parts; pass a different `maxSize` to see how part size affects
peak memory and time (see RESULTS.md — this matters a lot here).

The generated fixture is written under `.fixtures/` (gitignored) and can be
large (hundreds of MB to ~1GB) — delete it when done.
