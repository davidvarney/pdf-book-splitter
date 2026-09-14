import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { FileSystemPort } from "../io/types.js";
import { findPdfFilesUsing, type ScannedFile } from "../batch.js";

export const nodeFileSystem: FileSystemPort = {
  async listDir(dirPath) {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries.map((entry) => ({ name: entry.name, isFile: entry.isFile() }));
  },
  async statSize(filePath) {
    const info = await stat(filePath);
    return info.size;
  },
  joinPath: (...segments) => path.join(...segments),
};

/** Node-backed convenience wrapper around findPdfFilesUsing for CLI/desktop hosts. */
export async function findPdfFiles(dirPath: string): Promise<ScannedFile[]> {
  return findPdfFilesUsing(dirPath, nodeFileSystem);
}
