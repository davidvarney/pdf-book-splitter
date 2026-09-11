import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findPdfFiles, partitionByThreshold } from "../src/batch.js";

describe("findPdfFiles", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "pdf-book-splitter-test-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("finds .pdf files case-insensitively, ignores other files, and sorts by name", async () => {
    await writeFile(path.join(dir, "b.pdf"), "b");
    await writeFile(path.join(dir, "a.PDF"), "a");
    await writeFile(path.join(dir, "notes.txt"), "not a pdf");

    const files = await findPdfFiles(dir);

    expect(files.map((f) => f.fileName)).toEqual(["a.PDF", "b.pdf"]);
    expect(files.every((f) => f.size > 0)).toBe(true);
  });

  it("does not descend into subdirectories", async () => {
    await writeFile(path.join(dir, "top.pdf"), "top");
    await mkdir(path.join(dir, "nested"));
    await writeFile(path.join(dir, "nested", "inner.pdf"), "inner");

    const files = await findPdfFiles(dir);

    expect(files.map((f) => f.fileName)).toEqual(["top.pdf"]);
  });

  it("returns an empty list for a directory with no PDFs", async () => {
    const files = await findPdfFiles(dir);
    expect(files).toEqual([]);
  });
});

describe("partitionByThreshold", () => {
  it("splits files larger than the threshold from those at or under it", () => {
    const files = [
      { fileName: "a", filePath: "/a", size: 100 },
      { fileName: "b", filePath: "/b", size: 200 },
      { fileName: "c", filePath: "/c", size: 300 },
    ];

    const { toSplit, skipped } = partitionByThreshold(files, 200);

    expect(toSplit.map((f) => f.fileName)).toEqual(["c"]);
    expect(skipped.map((f) => f.fileName)).toEqual(["a", "b"]);
  });
});
