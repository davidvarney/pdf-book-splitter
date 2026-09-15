// pdf.js is only needed by the page-picker UI (single-file, page-range
// mode), so every caller reaches this module via dynamic import — it must
// never be statically imported, or its ~1MB+ would land in the main chunk
// for users who only ever use size-based splitting.

export interface PdfPreviewDocument {
  numPages: number;
  /** Renders one page (1-based) into the given canvas, sized to maxWidth. */
  renderPageToCanvas(pageNumber: number, canvas: HTMLCanvasElement, maxWidth: number): Promise<void>;
  destroy(): void;
}

let workerConfigured = false;

export async function loadPdfPreview(bytes: Uint8Array): Promise<PdfPreviewDocument> {
  const pdfjsLib = await import("pdfjs-dist");

  if (!workerConfigured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();
    workerConfigured = true;
  }

  // pdf.js detaches/transfers the buffer it's given, so hand it a copy —
  // the caller's SourceFile.bytes may still be needed elsewhere (splitting).
  const loadingTask = pdfjsLib.getDocument({ data: bytes.slice() });
  const doc = await loadingTask.promise;

  return {
    numPages: doc.numPages,
    async renderPageToCanvas(pageNumber, canvas, maxWidth) {
      const page = await doc.getPage(pageNumber);
      const unscaledViewport = page.getViewport({ scale: 1 });
      const scale = maxWidth / unscaledViewport.width;
      const viewport = page.getViewport({ scale });

      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) return;

      await page.render({ canvas, canvasContext: context, viewport }).promise;
    },
    destroy() {
      // destroy() lives on the loading task, not the resolved document proxy.
      void loadingTask.destroy();
    },
  };
}
