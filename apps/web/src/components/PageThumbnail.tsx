import { useEffect, useRef, useState } from "react";
import type { PdfPreviewDocument } from "../lib/pdfPreview.js";

const THUMBNAIL_WIDTH = 110;

interface PageThumbnailProps {
  doc: PdfPreviewDocument;
  pageNumber: number;
  isMarked: boolean;
  disabled: boolean;
  onToggle: (page: number) => void;
}

export function PageThumbnail({ doc, pageNumber, isMarked, disabled, onToggle }: PageThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRendered, setIsRendered] = useState(false);

  // Renders lazily (only once this cell scrolls near the viewport) so
  // picking a page-range split point stays fast even on a book with
  // hundreds of pages.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        const canvas = canvasRef.current;
        if (canvas) void doc.renderPageToCanvas(pageNumber, canvas, THUMBNAIL_WIDTH).then(() => setIsRendered(true));
      },
      { rootMargin: "300px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [doc, pageNumber]);

  return (
    <div
      ref={containerRef}
      className={[
        "page-thumb",
        isMarked && "page-thumb--marked",
        disabled && "page-thumb--disabled",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={() => !disabled && onToggle(pageNumber)}
      role="checkbox"
      aria-checked={isMarked}
      aria-disabled={disabled}
      aria-label={disabled ? `Page ${pageNumber} (last page)` : `Split after page ${pageNumber}`}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onToggle(pageNumber);
        }
      }}
    >
      <div className={`page-thumb__canvas-wrap${isRendered ? "" : " page-thumb__canvas-wrap--loading"}`}>
        <canvas ref={canvasRef} />
      </div>
      <span className="page-thumb__number">{pageNumber}</span>
      {isMarked && <span className="page-thumb__badge">Split after</span>}
    </div>
  );
}
