import type { SourceFile } from "./splitRunner.js";
import type { FileSplitResult } from "./splitRunner.js";

/**
 * True when running inside the Tauri desktop shell. The web UI is also
 * deployed standalone to GitHub Pages, so every Tauri API is imported
 * dynamically and gated behind this check — a plain browser bundle must
 * never even attempt to load `@tauri-apps/api`.
 */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Opens the native "choose PDF file(s)" dialog and reads the chosen files. */
export async function pickFilesViaDialog(multiple: boolean): Promise<SourceFile[]> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const { readFile } = await import("@tauri-apps/plugin-fs");

  const selection = await open({
    multiple,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (!selection) return [];

  const paths = Array.isArray(selection) ? selection : [selection];
  return Promise.all(paths.map((path) => readPickedFile(path, readFile)));
}

async function readPickedFile(
  path: string,
  readFile: (path: string) => Promise<Uint8Array>
): Promise<SourceFile> {
  const bytes = await readFile(path);
  const name = path.split(/[/\\]/).pop() ?? path;
  return { name, size: bytes.length, bytes };
}

/**
 * Subscribes to the OS window's native file drag-and-drop event. Tauri
 * intercepts this at the webview level and hands over real filesystem
 * paths instead of browser File objects (which is why Dropzone's own
 * HTML5 drag/drop handlers are disabled when isTauri() is true). Returns
 * an unsubscribe function.
 */
export async function listenForNativeFileDrop(
  onFiles: (files: SourceFile[]) => void
): Promise<() => void> {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const { readFile } = await import("@tauri-apps/plugin-fs");

  const unlisten = await getCurrentWindow().onDragDropEvent(async (event) => {
    if (event.payload.type !== "drop") return;
    const pdfPaths = event.payload.paths.filter((path) => path.toLowerCase().endsWith(".pdf"));
    if (pdfPaths.length === 0) return;
    const files = await Promise.all(pdfPaths.map((path) => readPickedFile(path, readFile)));
    onFiles(files);
  });
  return unlisten;
}

/** Subscribes to the native File > Open PDF... menu item. Returns an unsubscribe function. */
export async function listenForNativeOpenMenu(onTriggered: () => void): Promise<() => void> {
  const { listen } = await import("@tauri-apps/api/event");
  return listen("menu://open-pdf", () => onTriggered());
}

/**
 * Writes every split result to disk via a native "choose output folder"
 * dialog, instead of the browser's per-file <a download> links (which
 * Tauri's webview doesn't handle the same way as a real browser). Mirrors
 * the CLI's directory-batch convention: in batch mode, each source file
 * gets its own subfolder inside the chosen root; in single-file mode,
 * parts are written directly into it. Returns the chosen root folder, or
 * null if the user cancelled.
 */
export async function saveResultsViaDialog(results: FileSplitResult[]): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const { mkdir, writeFile } = await import("@tauri-apps/plugin-fs");

  const rootDir = await open({ directory: true, multiple: false });
  if (!rootDir || Array.isArray(rootDir)) return null;

  const isBatch = results.length > 1;
  for (const result of results) {
    if (result.status === "skipped" || result.outputs.length === 0) continue;

    const baseName = result.sourceName.replace(/\.pdf$/i, "");
    const outDir = isBatch ? `${rootDir}/${baseName}` : rootDir;
    await mkdir(outDir, { recursive: true });

    for (const output of result.outputs) {
      await writeFile(`${outDir}/${output.fileName}`, output.bytes);
    }
  }

  return rootDir;
}
