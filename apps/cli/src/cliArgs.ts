import { parseSize, parseCutPoints, type SplitStrategy } from "@pdf-book-splitter/core";

export type { SplitStrategy };

export interface SplitFileInvocation {
  mode: "file";
  inputPath: string;
  outDir?: string;
  strategy: SplitStrategy;
}

export interface SplitDirInvocation {
  mode: "dir";
  dirPath: string;
  maxBytes: number;
  thresholdBytes: number;
  outRoot?: string;
  /** Ask interactively for page numbers before splitting each oversized file. */
  interactive: boolean;
}

export interface SplitCsvInvocation {
  mode: "csv";
  csvPath: string;
  outRoot?: string;
}

export type SplitInvocation = SplitFileInvocation | SplitDirInvocation | SplitCsvInvocation;

export interface RawSplitOptions {
  size?: string;
  dir?: string;
  threshold?: string;
  out?: string;
  splitAt?: string;
  interactive?: boolean;
  csv?: string;
}

/**
 * Validates and interprets the raw `split` command arguments/options into a
 * single, unambiguous invocation. Pure (no filesystem access) so it can be
 * tested without touching disk. Does not handle --csv-template, which is a
 * standalone action the CLI layer short-circuits before reaching this.
 */
export function resolveSplitInvocation(
  inputArg: string | undefined,
  opts: RawSplitOptions
): SplitInvocation {
  const modesGiven = [Boolean(inputArg), Boolean(opts.dir), Boolean(opts.csv)].filter(Boolean).length;
  if (modesGiven > 1) {
    throw new Error("Provide exactly one of: a single input file, --dir, or --csv.");
  }
  if (modesGiven === 0) {
    throw new Error(
      "Provide a PDF file to split, use --dir to scan a directory, or use --csv to batch-process a list of files."
    );
  }

  if (opts.csv) {
    if (opts.splitAt) {
      throw new Error(
        '--split-at doesn\'t apply with --csv; specify "size" or "split_at" per row in the CSV file instead.'
      );
    }
    if (opts.size) {
      throw new Error(
        '--size doesn\'t apply with --csv; specify "size" or "split_at" per row in the CSV file instead.'
      );
    }
    if (opts.threshold) {
      throw new Error("--threshold doesn't apply with --csv.");
    }
    if (opts.interactive) {
      throw new Error("--interactive doesn't apply with --csv.");
    }
    return { mode: "csv", csvPath: opts.csv, outRoot: opts.out };
  }

  if (opts.dir) {
    if (opts.splitAt) {
      throw new Error(
        "--split-at can only be used when splitting a single file. Use --interactive to enter " +
          "page numbers for each oversized file found in the directory instead."
      );
    }
    if (!opts.size) {
      throw new Error("--size is required when using --dir.");
    }

    const maxBytes = parseSize(opts.size);
    const thresholdBytes = opts.threshold ? parseSize(opts.threshold) : maxBytes;
    return {
      mode: "dir",
      dirPath: opts.dir,
      maxBytes,
      thresholdBytes,
      outRoot: opts.out,
      interactive: Boolean(opts.interactive),
    };
  }

  if (opts.interactive) {
    throw new Error("--interactive can only be used with --dir.");
  }
  if (opts.splitAt && opts.size) {
    throw new Error("Provide either --size or --split-at, not both.");
  }
  if (!opts.splitAt && !opts.size) {
    throw new Error("Provide --size (to split by size) or --split-at (to split at specific pages).");
  }

  const strategy: SplitStrategy = opts.splitAt
    ? { kind: "pages", cutPoints: parseCutPoints(opts.splitAt) }
    : { kind: "size", maxBytes: parseSize(opts.size!) };

  return { mode: "file", inputPath: inputArg!, outDir: opts.out, strategy };
}
