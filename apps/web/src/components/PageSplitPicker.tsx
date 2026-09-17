import { useEffect, useState } from "react";
import { loadPdfPreview, type PdfPreviewDocument } from "../lib/pdfPreview.js";
import { PageThumbnail } from "./PageThumbnail.js";
import type { SourceFile } from "../lib/splitRunner.js";

interface PageSplitPickerProps {
  source: SourceFile;
  cutPoints: number[];
  onToggle: (page: number) => void;
  onClear: () => void;
}

export function PageSplitPicker({ source, cutPoints, onToggle, onClear }: PageSplitPickerProps) {
  const [doc, setDoc] = useState<PdfPreviewDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Keyed by source in App.tsx, so a fresh instance (and fresh initial
  // state) mounts whenever the selected file changes.
  useEffect(() => {
    let cancelled = false;
    let loadedDoc: PdfPreviewDocument | null = null;

    loadPdfPreview(source.bytes)
      .then((doc) => {
        if (cancelled) {
          doc.destroy();
          return;
        }
        loadedDoc = doc;
        setDoc(doc);
      })
      .catch((err) => setError((err as Error).message));

    return () => {
      cancelled = true;
      loadedDoc?.destroy();
    };
  }, [source]);

  if (error) return <p className="error">Couldn&apos;t load page previews: {error}</p>;
  if (!doc) return <p className="page-picker__loading">Loading page previews...</p>;

  const cutPointSet = new Set(cutPoints);
  const pages = Array.from({ length: doc.numPages }, (_, i) => i + 1);

  return (
    <div className="page-picker">
      <div className="page-picker__toolbar">
        <p className="page-picker__hint">
          Click a page to mark it as a split point ({cutPoints.length} selected).
        </p>
        {cutPoints.length > 0 && (
          <button type="button" className="page-picker__clear" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      <div className="page-picker__grid">
        {pages.map((pageNumber) => (
          <PageThumbnail
            key={pageNumber}
            doc={doc}
            pageNumber={pageNumber}
            isMarked={cutPointSet.has(pageNumber)}
            disabled={pageNumber === doc.numPages}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}
