import { parseSize } from "./size.js";

export interface SplitFileInvocation {
  mode: "file";
  inputPath: string;
  maxBytes: number;
  outDir?: string;
}

export interface SplitDirInvocation {
  mode: "dir";
  dirPath: string;
  maxBytes: number;
  thresholdBytes: number;
  outRoot?: string;
}

export type SplitInvocation = SplitFileInvocation | SplitDirInvocation;

export interface RawSplitOptions {
  size: string;
  dir?: string;
  threshold?: string;
  out?: string;
}

/**
 * Validates and interprets the raw `split` command arguments/options into a
 * single, unambiguous invocation. Pure (no filesystem access) so it can be
 * tested without touching disk.
 */
export function resolveSplitInvocation(
  inputArg: string | undefined,
  opts: RawSplitOptions
): SplitInvocation {
  if (opts.dir && inputArg) {
    throw new Error("Provide either a single input file or --dir, not both.");
  }
  if (!opts.dir && !inputArg) {
    throw new Error("Provide a PDF file to split, or use --dir to scan a directory.");
  }

  const maxBytes = parseSize(opts.size);

  if (opts.dir) {
    const thresholdBytes = opts.threshold ? parseSize(opts.threshold) : maxBytes;
    return { mode: "dir", dirPath: opts.dir, maxBytes, thresholdBytes, outRoot: opts.out };
  }

  return { mode: "file", inputPath: inputArg!, maxBytes, outDir: opts.out };
}
