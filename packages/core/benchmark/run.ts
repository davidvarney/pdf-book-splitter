// Measures wall-clock time and peak memory of splitPdfBySize against a real
// file on disk, to check the Phase 1 risk flagged in
// docs/platform-release-plan.md: pdf-lib holds the whole PDF in memory,
// which is fine for a CLI but needs checking against a large book before
// every future GUI shell (especially mobile) inherits the same constraint.
//
// Usage: tsx benchmark/run.ts <path-to-pdf> [maxSize]  (maxSize default: 25MB)
import { readFile } from "node:fs/promises";
import { splitPdfBySize, parseSize, formatSize } from "../src/index.js";

async function main(): Promise<void> {
  const inputPath = process.argv[2];
  const maxSizeArg = process.argv[3] ?? "25MB";

  if (!inputPath) {
    console.error("Usage: tsx benchmark/run.ts <path-to-pdf> [maxSize]");
    process.exitCode = 1;
    return;
  }

  const maxBytes = parseSize(maxSizeArg);

  console.log(`Reading "${inputPath}"...`);
  const sourceBytes = new Uint8Array(await readFile(inputPath));
  console.log(`Input size: ${formatSize(sourceBytes.length)}`);
  console.log(`Splitting into parts no larger than ${formatSize(maxBytes)}...\n`);

  let peakRss = 0;
  let peakHeapUsed = 0;
  const sample = (): void => {
    const mem = process.memoryUsage();
    if (mem.rss > peakRss) peakRss = mem.rss;
    if (mem.heapUsed > peakHeapUsed) peakHeapUsed = mem.heapUsed;
  };
  sample();
  const interval = setInterval(sample, 200);

  const start = Date.now();
  const { parts, warnings } = await splitPdfBySize(sourceBytes, {
    maxBytes,
    onProgress: (done, total) => {
      sample();
      if (done % 50 === 0 || done === total) {
        process.stdout.write(`\r  page ${done}/${total}`);
      }
    },
  });
  const elapsedMs = Date.now() - start;

  clearInterval(interval);
  sample();

  console.log("\n");
  console.log("--- Results ---");
  console.log(`Input size:        ${formatSize(sourceBytes.length)}`);
  console.log(`Parts produced:    ${parts.length}`);
  console.log(`Warnings:          ${warnings.length}`);
  console.log(`Elapsed:           ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(`Peak RSS:          ${formatSize(peakRss)}`);
  console.log(`Peak heap used:    ${formatSize(peakHeapUsed)}`);
  console.log(`Peak RSS / input:  ${(peakRss / sourceBytes.length).toFixed(2)}x`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
