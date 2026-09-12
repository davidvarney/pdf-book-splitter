import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { getPdfPageCount, splitPdfByPageRanges, splitPdfBySize } from "../src/split.js";

/**
 * Builds a test PDF with `pageCount` pages. Pages at indices in
 * `heavyPageIndices` get a large text block drawn on them (to make their
 * serialized size much larger than a plain page); the rest stay small.
 */
async function buildTestPdf(
  pageCount: number,
  heavyPageIndices: number[] = []
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const heavy = new Set(heavyPageIndices);

  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([300, 300]);
    if (heavy.has(i)) {
      // Many separate draw calls reliably bloat the content stream,
      // regardless of pdf-lib's text-wrapping behavior for long strings.
      for (let line = 0; line < 500; line++) {
        page.drawText("The quick brown fox jumps over the lazy dog.", {
          x: 10,
          y: 10,
          size: 6,
          font,
        });
      }
    } else {
      page.drawText(`page ${i}`, { x: 10, y: 150, size: 8, font });
    }
  }

  return doc.save();
}

function assertCoversAllPagesInOrder(parts: { pageIndices: number[] }[], pageCount: number) {
  const seen = parts.flatMap((p) => p.pageIndices);
  expect(seen).toEqual(Array.from({ length: pageCount }, (_, i) => i));
}

describe("splitPdfBySize", () => {
  it("keeps everything in one part when the limit is generous", async () => {
    const pdf = await buildTestPdf(5);
    const { parts, warnings } = await splitPdfBySize(pdf, { maxBytes: 10 * 1024 * 1024 });

    expect(parts).toHaveLength(1);
    expect(warnings).toHaveLength(0);
    assertCoversAllPagesInOrder(parts, 5);
  });

  it("splits into multiple parts, none exceeding the max size, covering every page once in order", async () => {
    const pdf = await buildTestPdf(20);

    // Find a max size that forces more than one part by referencing the
    // whole-doc size, then use a fraction of it.
    const whole = await splitPdfBySize(pdf, { maxBytes: Number.MAX_SAFE_INTEGER });
    const wholeSize = whole.parts[0].bytes.length;
    const maxBytes = Math.ceil(wholeSize / 4);

    const { parts, warnings } = await splitPdfBySize(pdf, { maxBytes });

    expect(parts.length).toBeGreaterThan(1);
    expect(warnings).toHaveLength(0);
    assertCoversAllPagesInOrder(parts, 20);
    for (const part of parts) {
      expect(part.bytes.length).toBeLessThanOrEqual(maxBytes);
    }
  });

  it("gives the last part the leftover pages instead of forcing equal sizes", async () => {
    const pdf = await buildTestPdf(7);
    const whole = await splitPdfBySize(pdf, { maxBytes: Number.MAX_SAFE_INTEGER });
    const wholeSize = whole.parts[0].bytes.length;
    // Big enough to fit several pages per part, but not all 7.
    const maxBytes = Math.ceil(wholeSize / 2);

    const { parts } = await splitPdfBySize(pdf, { maxBytes });

    assertCoversAllPagesInOrder(parts, 7);
    expect(parts.length).toBeGreaterThanOrEqual(2);
    // Every part but possibly the last should be "full" (adding one more
    // page from the next part would have overflowed); we just assert the
    // last part is non-empty and no part is empty.
    for (const part of parts) {
      expect(part.pageIndices.length).toBeGreaterThan(0);
    }
  });

  it("keeps an oversized single page whole and warns, without corrupting other parts", async () => {
    const pdf = await buildTestPdf(4, [2]);

    // Measure the heavy page's standalone size by splitting with a tiny cap.
    const probe = await splitPdfBySize(pdf, { maxBytes: 1 });
    const heavyPartSize = probe.parts.find((p) => p.pageIndices.includes(2))!.bytes.length;

    const maxBytes = Math.ceil(heavyPartSize / 2);
    const { parts, warnings } = await splitPdfBySize(pdf, { maxBytes });

    assertCoversAllPagesInOrder(parts, 4);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((w) => /Page 3/.test(w))).toBe(true);

    const heavyPart = parts.find((p) => p.pageIndices.includes(2))!;
    expect(heavyPart.pageIndices).toEqual([2]);
    expect(heavyPart.bytes.length).toBeGreaterThan(maxBytes);

    for (const part of parts) {
      if (!part.pageIndices.includes(2)) {
        expect(part.bytes.length).toBeLessThanOrEqual(maxBytes);
      }
    }
  });

  it("rejects a non-positive maxBytes", async () => {
    const pdf = await buildTestPdf(1);
    await expect(splitPdfBySize(pdf, { maxBytes: 0 })).rejects.toThrow();
  });
});

describe("getPdfPageCount", () => {
  it("returns the number of pages without producing any output", async () => {
    const pdf = await buildTestPdf(9);
    await expect(getPdfPageCount(pdf)).resolves.toBe(9);
  });
});

describe("splitPdfByPageRanges", () => {
  it("splits at the given cut points, covering every page once in order", async () => {
    const pdf = await buildTestPdf(10);
    const { parts } = await splitPdfByPageRanges(pdf, [3, 7]);

    expect(parts.map((p) => p.pageIndices)).toEqual([[0, 1, 2], [3, 4, 5, 6], [7, 8, 9]]);
    assertCoversAllPagesInOrder(parts, 10);
    for (const part of parts) {
      // Each part should be a real, loadable PDF with the expected page count.
      const doc = await PDFDocument.load(part.bytes);
      expect(doc.getPageCount()).toBe(part.pageIndices.length);
    }
  });

  it("produces a single part when there are no cut points", async () => {
    const pdf = await buildTestPdf(5);
    const { parts } = await splitPdfByPageRanges(pdf, []);
    expect(parts).toHaveLength(1);
    assertCoversAllPagesInOrder(parts, 5);
  });

  it("does not apply any size limit, even with a heavy page in a part", async () => {
    const pdf = await buildTestPdf(4, [1]);
    const { parts } = await splitPdfByPageRanges(pdf, [2]);
    assertCoversAllPagesInOrder(parts, 4);
    expect(parts).toHaveLength(2);
  });

  it("rejects an out-of-range cut point", async () => {
    const pdf = await buildTestPdf(5);
    await expect(splitPdfByPageRanges(pdf, [5])).rejects.toThrow(/Invalid split point/);
  });
});
