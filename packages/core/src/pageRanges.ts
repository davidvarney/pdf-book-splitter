/**
 * Parses a comma-separated list of page numbers to split after (e.g.
 * "50,120,180") into a sorted, de-duplicated array of positive integers.
 * Does not know the source PDF's page count; see computePageIndexGroups
 * for the bounds check against an actual page count.
 */
export function parseCutPoints(input: string): number[] {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('No page numbers given. Provide a comma-separated list, e.g. "50,120".');
  }

  const numbers = trimmed
    .split(",")
    .map((piece) => piece.trim())
    .filter((piece) => piece.length > 0)
    .map((piece) => {
      const value = Number(piece);
      if (!Number.isInteger(value) || value < 1) {
        throw new Error(`Invalid page number "${piece}". Page numbers must be positive whole numbers.`);
      }
      return value;
    });

  if (numbers.length === 0) {
    throw new Error('No page numbers given. Provide a comma-separated list, e.g. "50,120".');
  }

  return Array.from(new Set(numbers)).sort((a, b) => a - b);
}

/**
 * Turns a list of "split after this page" cut points into contiguous,
 * zero-based page index groups covering every page of a pageCount-page
 * document exactly once, in order.
 */
export function computePageIndexGroups(cutPoints: number[], pageCount: number): number[][] {
  if (pageCount <= 0) {
    throw new Error("The PDF has no pages to split.");
  }

  for (let i = 0; i < cutPoints.length; i++) {
    const cutPoint = cutPoints[i];
    if (!Number.isInteger(cutPoint) || cutPoint < 1 || cutPoint >= pageCount) {
      throw new Error(
        `Invalid split point ${cutPoint}: must be a whole number between 1 and ${pageCount - 1} ` +
          `for this ${pageCount}-page file.`
      );
    }
    if (i > 0 && cutPoint <= cutPoints[i - 1]) {
      throw new Error("Split points must be strictly increasing, with no duplicates.");
    }
  }

  const groups: number[][] = [];
  let start = 0;
  for (const cutPoint of cutPoints) {
    groups.push(Array.from({ length: cutPoint - start }, (_, i) => start + i));
    start = cutPoint;
  }
  groups.push(Array.from({ length: pageCount - start }, (_, i) => start + i));

  return groups;
}
