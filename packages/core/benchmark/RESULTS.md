# Large-file benchmark results

Measured 2026-09-14 on a MacBook (Apple Silicon, Node 22), against a
synthetic 550-page, 605.2MB PDF (each page a unique 620x620 random-noise
PNG, so pages can't dedupe a shared resource — see `generateLargePdf.ts`).
This is a worst case for memory relative to page count (a real scanned book
of the same file size typically has far fewer, larger images shared less
than random noise, but similar total resident bytes), not necessarily for
CPU time.

| Run | maxBytes | Parts | Elapsed | Peak RSS | Peak RSS / input |
|---|---|---|---|---|---|
| Typical CLI use | 25MB | 25 | 6.8s | 2.8 GB | 4.81x |
| Large maxBytes (~1 output file) | 1GB | 1 | 4.3s | 3.7 GB | 6.20x |
| Tight maxBytes (~1 page/part) | 2MB | 550 | 110.8s | 2.9 GB | 4.98x |

Peak **heap used** stayed under 25MB in every run — `pdf-lib` keeps document
data in off-heap Buffers, so RSS (not V8 heap) is the number that matters
for this tool's memory footprint.

## What this means

**1. Peak memory is ~5-6x the input file size, not ~1-2x.** The source PDF
stays fully parsed and resident for the whole run (every candidate part
copies pages out of it), and each candidate part being built is itself a
second, mostly-full copy of the pages it contains, serialized to a third
buffer. For a 605MB book that's ~2.8-3.7GB of peak RSS. A phone with 4-6GB
of total RAM and per-app limits well under that (iOS in particular kills a
WebView process well before it reaches multiple GB) will not be able to
split a book this size today. This is the sharpest version of the risk the
plan called out, now with a number attached: **the practical size ceiling
on mobile is probably in the tens-of-MB-to-low-hundreds-of-MB range, not
"whatever a phone's total RAM is."** Worth deciding in Phase 6 whether to
(a) cap accepted file size on mobile with a clear error, or (b) revisit the
algorithm (below) before then.

**2. Larger `maxBytes` (fewer, bigger parts) costs more memory, not less.**
Counter-intuitively, asking for 1 big output part (1GB cap) peaked higher
(6.20x) than asking for 25 smaller ones (4.81x): the single worst-case
candidate the binary search has to build scales with how many pages end up
in one part, and building a 550-page candidate is nearly as expensive as
holding the whole source again. A GUI that offers "just make it small
enough for email" with a large threshold is the worst case, not the best.

**3. Very tight `maxBytes` is a real time cliff, independent of memory.**
2MB parts took 110.8s vs. 6.8s for 25MB parts (16x slower) for the same
605MB input, at essentially the same peak memory. The cause is in
`splitPdfBySize`'s binary search (`split.ts`): each part's search starts
from `hi = remaining` (*all* pages left in the book), so even when the
answer converges to "1 page fits," the search still builds and serializes
several large, doomed candidates (hundreds of pages) on the way down before
narrowing in — and it repeats that wide starting range for every one of the
550 output parts. This is O(pages) wasted large candidate builds per part
in the tight-size-cap case, not a fixed cost. A GUI progress bar that looks
fine at 25MB parts could look hung at 2MB parts on the same file. Worth
capping the binary search's initial `hi` to something like
`min(remaining, previous part's page count * small factor)` before this
algorithm is relied on by an interactive UI with a spinner budget.

## Reproducing

```
npm run bench:generate -w packages/core -- 550 620
npm run bench:run -w packages/core -- benchmark/.fixtures/large-benchmark.pdf 25MB
npm run bench:run -w packages/core -- benchmark/.fixtures/large-benchmark.pdf 1GB
npm run bench:run -w packages/core -- benchmark/.fixtures/large-benchmark.pdf 2MB
```
