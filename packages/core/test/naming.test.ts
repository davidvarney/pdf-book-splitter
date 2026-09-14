import { describe, expect, it } from "vitest";
import { buildPartFileName } from "../src/naming.js";

describe("buildPartFileName", () => {
  it("zero-pads to at least 2 digits", () => {
    expect(buildPartFileName("my-book", 1, 5)).toBe("my-book_part01_of_05.pdf");
    expect(buildPartFileName("my-book", 5, 5)).toBe("my-book_part05_of_05.pdf");
  });

  it("widens padding for double-digit totals", () => {
    expect(buildPartFileName("my-book", 3, 12)).toBe("my-book_part03_of_12.pdf");
  });

  it("widens padding for triple-digit totals", () => {
    expect(buildPartFileName("my-book", 7, 120)).toBe("my-book_part007_of_120.pdf");
  });

  it("sorts lexicographically in the same order as numerically", () => {
    const names = [1, 2, 10, 11].map((n) => buildPartFileName("book", n, 11));
    const sorted = [...names].sort();
    expect(sorted).toEqual(names);
  });
});
