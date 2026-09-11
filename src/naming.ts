/**
 * Builds the consistent, read-order-clear file name for one split part.
 *
 * Example: baseName "my-book", part 2 of 12 -> "my-book_part02_of_12.pdf"
 */
export function buildPartFileName(
  baseName: string,
  partNumber: number,
  totalParts: number
): string {
  const width = Math.max(2, String(totalParts).length);
  const paddedPart = String(partNumber).padStart(width, "0");
  const paddedTotal = String(totalParts).padStart(width, "0");
  return `${baseName}_part${paddedPart}_of_${paddedTotal}.pdf`;
}
