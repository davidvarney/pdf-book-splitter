import { readdir, stat } from "node:fs/promises";
import path from "node:path";

export interface ScannedFile {
  fileName: string;
  filePath: string;
  size: number;
}

/**
 * Lists the PDF files directly inside a directory (non-recursive, so any
 * output subfolders a previous split run created there aren't re-scanned),
 * sorted by name.
 */
export async function findPdfFiles(dirPath: string): Promise<ScannedFile[]> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const pdfEntries = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"))
    .sort((a, b) => a.name.localeCompare(b.name));

  const results: ScannedFile[] = [];
  for (const entry of pdfEntries) {
    const filePath = path.join(dirPath, entry.name);
    const info = await stat(filePath);
    results.push({ fileName: entry.name, filePath, size: info.size });
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
