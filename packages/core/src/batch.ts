import type { FileSystemPort } from "./io/types.js";

export interface ScannedFile {
  fileName: string;
  filePath: string;
  size: number;
}

/**
 * Lists the PDF files directly inside a directory (non-recursive, so any
 * output subfolders a previous split run created there aren't re-scanned),
 * sorted by name. Takes a FileSystemPort so it has no host-specific imports
 * of its own; see ./node/fsAdapter.ts for the Node-backed implementation
 * the CLI uses.
 */
export async function findPdfFilesUsing(
  dirPath: string,
  fs: FileSystemPort
): Promise<ScannedFile[]> {
  const entries = await fs.listDir(dirPath);
  const pdfEntries = entries
    .filter((entry) => entry.isFile && entry.name.toLowerCase().endsWith(".pdf"))
    .sort((a, b) => a.name.localeCompare(b.name));

  const results: ScannedFile[] = [];
  for (const entry of pdfEntries) {
    const filePath = fs.joinPath(dirPath, entry.name);
    const size = await fs.statSize(filePath);
    results.push({ fileName: entry.name, filePath, size });
  }
  return results;
}

/** Splits scanned files into those over the threshold and those at/under it. */
export function partitionByThreshold(
  files: ScannedFile[],
  thresholdBytes: number
): { toSplit: ScannedFile[]; skipped: ScannedFile[] } {
  const toSplit = files.filter((f) => f.size > thresholdBytes);
  const skipped = files.filter((f) => f.size <= thresholdBytes);
  return { toSplit, skipped };
}
