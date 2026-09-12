import { describe, expect, it } from "vitest";
import { resolveSplitInvocation } from "../src/cliArgs.js";

describe("resolveSplitInvocation", () => {
  describe("single-file mode", () => {
    it("resolves a size strategy from a positional input", () => {
      const result = resolveSplitInvocation("book.pdf", { size: "25MB" });
      expect(result).toEqual({
        mode: "file",
        inputPath: "book.pdf",
        outDir: undefined,
        strategy: { kind: "size", maxBytes: 25 * 1024 ** 2 },
      });
    });

    it("resolves a pages strategy from --split-at", () => {
      const result = resolveSplitInvocation("book.pdf", { splitAt: "50,120" });
      expect(result).toEqual({
        mode: "file",
        inputPath: "book.pdf",
        outDir: undefined,
        strategy: { kind: "pages", cutPoints: [50, 120] },
      });
    });

    it("passes --out through", () => {
      const result = resolveSplitInvocation("book.pdf", { size: "25MB", out: "./parts" });
      expect(result.mode).toBe("file");
      expect((result as { outDir?: string }).outDir).toBe("./parts");
    });

    it("rejects both --size and --split-at", () => {
      expect(() =>
        resolveSplitInvocation("book.pdf", { size: "25MB", splitAt: "50,120" })
      ).toThrow(/either --size or --split-at/);
    });

    it("rejects neither --size nor --split-at", () => {
      expect(() => resolveSplitInvocation("book.pdf", {})).toThrow(
        /Provide --size .* or --split-at/
      );
    });

    it("rejects --interactive without --dir", () => {
      expect(() =>
        resolveSplitInvocation("book.pdf", { size: "25MB", interactive: true })
      ).toThrow(/--interactive can only be used with --dir/);
    });

    it("propagates an invalid --size error", () => {
      expect(() => resolveSplitInvocation("book.pdf", { size: "not-a-size" })).toThrow(/Invalid size/);
    });

    it("propagates an invalid --split-at error", () => {
      expect(() => resolveSplitInvocation("book.pdf", { splitAt: "abc" })).toThrow(
        /Invalid page number/
      );
    });
  });

  describe("directory mode", () => {
    it("resolves directory mode from --dir", () => {
      const result = resolveSplitInvocation(undefined, { size: "25MB", dir: "./books" });
      expect(result).toEqual({
        mode: "dir",
        dirPath: "./books",
        maxBytes: 25 * 1024 ** 2,
        thresholdBytes: 25 * 1024 ** 2,
        outRoot: undefined,
        interactive: false,
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

    it("carries the --interactive flag through", () => {
      const result = resolveSplitInvocation(undefined, {
        size: "25MB",
        dir: "./books",
        interactive: true,
      });
      expect(result.mode).toBe("dir");
      expect((result as { interactive: boolean }).interactive).toBe(true);
    });

    it("requires --size", () => {
      expect(() => resolveSplitInvocation(undefined, { dir: "./books" })).toThrow(
        /--size is required when using --dir/
      );
    });

    it("rejects --split-at with --dir", () => {
      expect(() =>
        resolveSplitInvocation(undefined, { size: "25MB", dir: "./books", splitAt: "50,120" })
      ).toThrow(/--split-at can only be used when splitting a single file/);
    });

    it("propagates an invalid --threshold error", () => {
      expect(() =>
        resolveSplitInvocation(undefined, { size: "25MB", dir: "./books", threshold: "nope" })
      ).toThrow(/Invalid size/);
    });
  });

  describe("csv mode", () => {
    it("resolves csv mode from --csv", () => {
      const result = resolveSplitInvocation(undefined, { csv: "./batch.csv" });
      expect(result).toEqual({ mode: "csv", csvPath: "./batch.csv", outRoot: undefined });
    });

    it("passes --out through as outRoot", () => {
      const result = resolveSplitInvocation(undefined, { csv: "./batch.csv", out: "./root" });
      expect(result.mode).toBe("csv");
      expect((result as { outRoot?: string }).outRoot).toBe("./root");
    });

    it("rejects --size with --csv", () => {
      expect(() => resolveSplitInvocation(undefined, { csv: "./batch.csv", size: "25MB" })).toThrow(
        /doesn't apply with --csv/
      );
    });

    it("rejects --split-at with --csv", () => {
      expect(() =>
        resolveSplitInvocation(undefined, { csv: "./batch.csv", splitAt: "50,120" })
      ).toThrow(/doesn't apply with --csv/);
    });

    it("rejects --threshold with --csv", () => {
      expect(() =>
        resolveSplitInvocation(undefined, { csv: "./batch.csv", threshold: "10MB" })
      ).toThrow(/--threshold doesn't apply with --csv/);
    });

    it("rejects --interactive with --csv", () => {
      expect(() =>
        resolveSplitInvocation(undefined, { csv: "./batch.csv", interactive: true })
      ).toThrow(/--interactive doesn't apply with --csv/);
    });
  });

  it("rejects both a positional input and --dir", () => {
    expect(() =>
      resolveSplitInvocation("book.pdf", { size: "25MB", dir: "./books" })
    ).toThrow(/exactly one of/);
  });

  it("rejects a positional input together with --csv", () => {
    expect(() => resolveSplitInvocation("book.pdf", { csv: "./batch.csv" })).toThrow(
      /exactly one of/
    );
  });

  it("rejects --dir together with --csv", () => {
    expect(() => resolveSplitInvocation(undefined, { dir: "./books", csv: "./batch.csv" })).toThrow(
      /exactly one of/
    );
  });

  it("rejects neither a positional input, --dir, nor --csv", () => {
    expect(() => resolveSplitInvocation(undefined, { size: "25MB" })).toThrow(
      /Provide a PDF file to split/
    );
  });
});
