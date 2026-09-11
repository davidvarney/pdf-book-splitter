import { PDFDocument } from "pdf-lib";

export interface SplitPart {
  /** Zero-based indices of the source pages included in this part, in order. */
  pageIndices: number[];
  /** Serialized bytes of this part's PDF. */
  bytes: Uint8Array;
}

export interface SplitResult {
  parts: SplitPart[];
  /** Warnings for pages that alone exceed maxBytes and could not be shrunk further. */
  warnings: string[];
}

export interface SplitOptions {
  /** Maximum allowed size, in bytes, for each output file. */
  maxBytes: number;
  /** Optional progress callback, called after each source page is placed into a part. */
  onProgress?: (pagesProcessed: number, totalPages: number) => void;
}

/**
 * Splits a source PDF into consecutive-page parts, greedily packing as many
 * whole pages as will fit under maxBytes into each part. Pages are never
 * split or otherwise modified. The last part holds whatever remainder of
 * pages is left over once the rest have been packed to maxBytes.
 *
 * If a single page's serialized size alone exceeds maxBytes, that page still
 * becomes its own part (a whole page is never damaged to force it under the
 * limit) and a warning is recorded.
 */
export async function splitPdfBySize(
  sourceBytes: Uint8Array,
  options: SplitOptions
): Promise<SplitResult> {
  const { maxBytes, onProgress } = options;
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
    throw new Error("maxBytes must be a positive number.");
  }

  const source = await PDFDocument.load(sourceBytes);
  const pageCount = source.getPageCount();

  const parts: SplitPart[] = [];
  const warnings: string[] = [];

  // Builds and serializes a candidate part from a single copyPages call, so
  // shared resources (fonts, images) referenced by multiple pages are
  // deduplicated correctly within that candidate.
  const buildCandidate = async (startIndex: number, count: number): Promise<Uint8Array> => {
    const doc = await PDFDocument.create();
    const indices = Array.from({ length: count }, (_, i) => startIndex + i);
    const pages = await doc.copyPages(source, indices);
    for (const page of pages) doc.addPage(page);
    return doc.save();
  };

  let pageStart = 0;
  while (pageStart < pageCount) {
    const remaining = pageCount - pageStart;
    const singleBytes = await buildCandidate(pageStart, 1);

    if (singleBytes.length > maxBytes) {
      warnings.push(
        `Page ${pageStart + 1} is ${singleBytes.length} bytes on its own, which exceeds the ` +
          `requested maximum of ${maxBytes} bytes. It was kept as a single, undamaged page.`
      );
      parts.push({ pageIndices: [pageStart], bytes: singleBytes });
      pageStart += 1;
      onProgress?.(pageStart, pageCount);
      continue;
    }

    // Binary search for the largest page count (from pageStart) that still
    // fits within maxBytes.
    let lo = 1;
    let hi = remaining;
    let bestBytes = singleBytes;

    while (lo < hi) {
      const mid = lo + Math.ceil((hi - lo) / 2);
      const bytes = await buildCandidate(pageStart, mid);
      if (bytes.length <= maxBytes) {
        lo = mid;
        bestBytes = bytes;
      } else {
        hi = mid - 1;
      }
    }

    const pageIndices = Array.from({ length: lo }, (_, i) => pageStart + i);
    parts.push({ pageIndices, bytes: bestBytes });
    pageStart += lo;
    onProgress?.(pageStart, pageCount);
  }

  return { parts, warnings };
}
