import { describe, expect, it } from "vitest";
import {
  CSV_TEMPLATE_CONTENT,
  parseCsvBatch,
  resolveCsvBatchRows,
  resolveCsvBatchRowsOrErrors,
} from "../src/csvBatch.js";

describe("parseCsvBatch", () => {
  it("parses rows, skips comment and blank lines, and lowercases headers", () => {
    const csv = [
      "# a comment",
      "",
      "Input,Size,Split_At,Out",
      "a.pdf,25MB,,",
      "b.pdf,,\"50,120\",custom",
    ].join("\n");

    const rows = parseCsvBatch(csv);

    expect(rows).toEqual([
      { rowNumber: 1, input: "a.pdf", size: "25MB", splitAt: undefined, out: undefined },
      { rowNumber: 2, input: "b.pdf", size: undefined, splitAt: "50,120", out: "custom" },
    ]);
  });

  it("returns an empty array for a header-only or comment-only file", () => {
    expect(parseCsvBatch("input,size,split_at,out\n")).toEqual([]);
    expect(parseCsvBatch("# just a comment\n")).toEqual([]);
  });

  it("throws a clear error when the input column is missing", () => {
    expect(() => parseCsvBatch("size,split_at,out\n25MB,,\n")).toThrow(/missing an "input" column/);
  });

  it("parses its own template content without error", () => {
    const rows = parseCsvBatch(CSV_TEMPLATE_CONTENT);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.input.length > 0)).toBe(true);
  });
});

describe("resolveCsvBatchRows", () => {
  it("resolves a size strategy and a pages strategy", () => {
    const resolved = resolveCsvBatchRows([
      { rowNumber: 1, input: "a.pdf", size: "25MB" },
      { rowNumber: 2, input: "b.pdf", splitAt: "50,120" },
    ]);

    expect(resolved).toEqual([
      { rowNumber: 1, input: "a.pdf", out: undefined, strategy: { kind: "size", maxBytes: 25 * 1024 ** 2 } },
      { rowNumber: 2, input: "b.pdf", out: undefined, strategy: { kind: "pages", cutPoints: [50, 120] } },
    ]);
  });

  it("passes out through when given", () => {
    const resolved = resolveCsvBatchRows([{ rowNumber: 1, input: "a.pdf", size: "25MB", out: "custom" }]);
    expect(resolved[0].out).toBe("custom");
  });

  it("collects errors across all rows into a single combined error", () => {
    const rows = [
      { rowNumber: 1, input: "" }, // missing input
      { rowNumber: 2, input: "b.pdf", size: "25MB", splitAt: "50" }, // both given
      { rowNumber: 3, input: "c.pdf" }, // neither given
      { rowNumber: 4, input: "d.pdf", size: "not-a-size" }, // invalid size
      { rowNumber: 5, input: "e.pdf", size: "25MB" }, // valid, should not appear in errors
    ];

    expect.assertions(5);
    try {
      resolveCsvBatchRows(rows);
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toMatch(/Row 1/);
      expect(message).toMatch(/Row 2 \(b\.pdf\)/);
      expect(message).toMatch(/Row 3 \(c\.pdf\)/);
      expect(message).toMatch(/Row 4 \(d\.pdf\)/);
      expect(message).not.toMatch(/Row 5/);
    }
  });
});

describe("resolveCsvBatchRowsOrErrors", () => {
  it("never throws, returning both the resolved rows and the errors", () => {
    const { resolved, errors } = resolveCsvBatchRowsOrErrors([
      { rowNumber: 1, input: "a.pdf", size: "25MB" },
      { rowNumber: 2, input: "b.pdf" },
    ]);

    expect(resolved).toEqual([
      { rowNumber: 1, input: "a.pdf", out: undefined, strategy: { kind: "size", maxBytes: 25 * 1024 ** 2 } },
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/Row 2 \(b\.pdf\)/);
  });
});
