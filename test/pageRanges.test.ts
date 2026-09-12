import { describe, expect, it } from "vitest";
import { computePageIndexGroups, parseCutPoints } from "../src/pageRanges.js";

describe("parseCutPoints", () => {
  it("parses a comma-separated list into sorted numbers", () => {
    expect(parseCutPoints("50,120,180")).toEqual([50, 120, 180]);
  });

  it("sorts and de-duplicates out-of-order or repeated input", () => {
    expect(parseCutPoints("180,50,120,50")).toEqual([50, 120, 180]);
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseCutPoints(" 50 , 120 ")).toEqual([50, 120]);
  });

  it("rejects empty input", () => {
    expect(() => parseCutPoints("")).toThrow(/No page numbers given/);
    expect(() => parseCutPoints("   ")).toThrow(/No page numbers given/);
  });

  it("rejects non-integer or non-positive values", () => {
    expect(() => parseCutPoints("50,abc")).toThrow(/Invalid page number/);
    expect(() => parseCutPoints("0,50")).toThrow(/Invalid page number/);
    expect(() => parseCutPoints("-5,50")).toThrow(/Invalid page number/);
    expect(() => parseCutPoints("1.5,50")).toThrow(/Invalid page number/);
  });
});

describe("computePageIndexGroups", () => {
  it("produces contiguous zero-based groups covering every page", () => {
    const groups = computePageIndexGroups([50, 120], 200);
    expect(groups).toHaveLength(3);
    expect(groups[0]).toEqual(Array.from({ length: 50 }, (_, i) => i));
    expect(groups[1]).toEqual(Array.from({ length: 70 }, (_, i) => 50 + i));
    expect(groups[2]).toEqual(Array.from({ length: 80 }, (_, i) => 120 + i));

    const allIndices = groups.flat();
    expect(allIndices).toEqual(Array.from({ length: 200 }, (_, i) => i));
  });

  it("returns a single group when there are no cut points", () => {
    const groups = computePageIndexGroups([], 10);
    expect(groups).toEqual([Array.from({ length: 10 }, (_, i) => i)]);
  });

  it("rejects a cut point at or beyond the last page", () => {
    expect(() => computePageIndexGroups([200], 200)).toThrow(/Invalid split point/);
    expect(() => computePageIndexGroups([201], 200)).toThrow(/Invalid split point/);
  });

  it("rejects a cut point below 1", () => {
    expect(() => computePageIndexGroups([0], 200)).toThrow(/Invalid split point/);
  });

  it("rejects non-increasing or duplicate cut points", () => {
    expect(() => computePageIndexGroups([120, 50], 200)).toThrow(/strictly increasing/);
    expect(() => computePageIndexGroups([50, 50], 200)).toThrow(/strictly increasing/);
  });

  it("rejects a document with no pages", () => {
    expect(() => computePageIndexGroups([], 0)).toThrow(/no pages/);
  });
});
