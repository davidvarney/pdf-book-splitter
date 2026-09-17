/** Toggles `page` in a sorted, de-duplicated list of cut points. */
export function toggleCutPoint(cutPoints: number[], page: number): number[] {
  const set = new Set(cutPoints);
  if (set.has(page)) set.delete(page);
  else set.add(page);
  return Array.from(set).sort((a, b) => a - b);
}
