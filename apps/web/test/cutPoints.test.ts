import { describe, expect, it } from "vitest";
import { toggleCutPoint } from "../src/lib/cutPoints.js";

describe("toggleCutPoint", () => {
  it("adds a page not already present, keeping the list sorted", () => {
    expect(toggleCutPoint([10, 30], 20)).toEqual([10, 20, 30]);
  });

  it("removes a page already present", () => {
    expect(toggleCutPoint([10, 20, 30], 20)).toEqual([10, 30]);
  });

  it("de-duplicates if somehow asked to add twice", () => {
    expect(toggleCutPoint([5], 5)).toEqual([]);
  });
});
