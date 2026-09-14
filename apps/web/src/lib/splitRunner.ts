import {
  splitPdfBySize,
  splitPdfByPageRanges,
  buildPartFileName,
  partitionByThreshold,
  type ScannedFile,
  type SplitPart,
} from "@pdf-book-splitter/core";

export interface SourceFile {
  name: string;
  size: number;
  bytes: Uint8Array;
}

export type SplitStrategy = { kind: "size"; maxBytes: number } | { kind: "pages"; cutPoints: number[] };

export interface SplitOutputFile {
  fileName: string;
  bytes: Uint8Array;
  pageRangeLabel: string;
}

export interface FileSplitResult {
  sourceName: string;
  status: "split" | "skipped";
  outputs: SplitOutputFile[];
  warnings: string[];
}

function pageRangeLabel(part: SplitPart): string {
  const first = part.pageIndices[0] + 1;
  const last = part.pageIndices[part.pageIndices.length - 1] + 1;
  return first === last ? `page ${first}` : `pages ${first}-${last}`;
}

function baseNameOf(fileName: string): string {
  return fileName.replace(/\.pdf$/i, "");
}

/** Splits one source file with an already-resolved strategy. */
export async function splitOneFile(
  source: SourceFile,
  strategy: SplitStrategy,
  onProgress?: (done: number, total: number) => void
): Promise<FileSplitResult> {
  const baseName = baseNameOf(source.name);

  let parts: SplitPart[];
  let warnings: string[] = [];

  if (strategy.kind === "size") {
    const result = await splitPdfBySize(source.bytes, { maxBytes: strategy.maxBytes, onProgress });
    parts = result.parts;
    warnings = result.warnings;
  } else {
    const result = await splitPdfByPageRanges(source.bytes, strategy.cutPoints);
    parts = result.parts;
  }

  const outputs = parts.map((part, i) => ({
    fileName: buildPartFileName(baseName, i + 1, parts.length),
    bytes: part.bytes,
    pageRangeLabel: pageRangeLabel(part),
  }));

  return { sourceName: source.name, status: "split", outputs, warnings };
}

/**
 * Batch entry point mirroring the CLI's non-interactive directory-batch
 * semantics: files at or under thresholdBytes are left alone, everything
 * else is split by size. Page-range mode stays single-file only, same as
 * the CLI outside of --interactive, since cut points depend on knowing one
 * specific file's page count.
 */
export async function splitBatch(
  sources: SourceFile[],
  opts: { maxBytes: number; thresholdBytes: number },
  onFileProgress?: (fileName: string, done: number, total: number) => void
): Promise<FileSplitResult[]> {
  const scanned: ScannedFile[] = sources.map((s) => ({ fileName: s.name, filePath: s.name, size: s.size }));
  const { toSplit } = partitionByThreshold(scanned, opts.thresholdBytes);
  const namesToSplit = new Set(toSplit.map((f) => f.fileName));

  const results: FileSplitResult[] = [];
  for (const source of sources) {
    if (!namesToSplit.has(source.name)) {
      results.push({ sourceName: source.name, status: "skipped", outputs: [], warnings: [] });
      continue;
    }
    const result = await splitOneFile(source, { kind: "size", maxBytes: opts.maxBytes }, (done, total) =>
      onFileProgress?.(source.name, done, total)
    );
    results.push(result);
  }
  return results;
}
