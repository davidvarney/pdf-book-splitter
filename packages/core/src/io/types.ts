/**
 * Minimal directory-scanning boundary that batch.ts calls through instead of
 * a Node-specific module, so the same scan logic can run against any host's
 * own file access (Node's fs, a Tauri filesystem binding, etc.). There is no
 * browser implementation of this port: a web page can't enumerate an
 * arbitrary directory by path, so directory/CSV batch modes stay a
 * Node/desktop-shell feature by nature, not something the browser UI needs.
 */
export interface DirEntry {
  name: string;
  isFile: boolean;
}

export interface FileSystemPort {
  listDir(dirPath: string): Promise<DirEntry[]>;
  statSize(filePath: string): Promise<number>;
  joinPath(...segments: string[]): string;
}
