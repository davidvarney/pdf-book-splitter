import { describe, expect, it } from "vitest";
import { resolveSplitInvocation } from "../src/cliArgs.js";

describe("resolveSplitInvocation", () => {
  it("resolves single-file mode from a positional input", () => {
    const result = resolveSplitInvocation("book.pdf", { size: "25MB" });
    expect(result).toEqual({
      mode: "file",
      inputPath: "book.pdf",
      maxBytes: 25 * 1024 ** 2,
      outDir: undefined,
    });
  });

  it("passes --out through in single-file mode", () => {
    const result = resolveSplitInvocation("book.pdf", { size: "25MB", out: "./parts" });
    expect(result.mode).toBe("file");
    expect((result as { outDir?: string }).outDir).toBe("./parts");
  });

  it("resolves directory mode from --dir", () => {
    const result = resolveSplitInvocation(undefined, { size: "25MB", dir: "./books" });
    expect(result).toEqual({
      mode: "dir",
      dirPath: "./books",
      maxBytes: 25 * 1024 ** 2,
      thresholdBytes: 25 * 1024 ** 2,
      outRoot: undefined,
    });
  });

  it("defaults threshold to the split size when --threshold is omitted", () => {
    const result = resolveSplitInvocation(undefined, { size: "10MB", dir: "./books" });
    expect(result.mode).toBe("dir");
    expect((result as { thresholdBytes: number }).thresholdBytes).toBe(10 * 1024 ** 2);
  });

  it("uses an explicit --threshold when given", () => {
    const result = resolveSplitInvocation(undefined, {
      size: "25MB",
      dir: "./books",
      threshold: "100MB",
    });
    expect(result.mode).toBe("dir");
    expect((result as { thresholdBytes: number }).thresholdBytes).toBe(100 * 1024 ** 2);
  });

  it("rejects both a positional input and --dir", () => {
    expect(() => resolveSplitInvocation("book.pdf", { size: "25MB", dir: "./books" })).toThrow(
      /either a single input file or --dir/
    );
  });

  it("rejects neither a positional input nor --dir", () => {
    expect(() => resolveSplitInvocation(undefined, { size: "25MB" })).toThrow(
      /Provide a PDF file to split/
    );
  });

  it("propagates an invalid --size error", () => {
    expect(() => resolveSplitInvocation("book.pdf", { size: "not-a-size" })).toThrow(/Invalid size/);
  });

  it("propagates an invalid --threshold error", () => {
    expect(() =>
      resolveSplitInvocation(undefined, { size: "25MB", dir: "./books", threshold: "nope" })
    ).toThrow(/Invalid size/);
  });
});
