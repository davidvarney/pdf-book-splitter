import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { splitBatch, splitOneFile, type SourceFile } from "../src/lib/splitRunner.js";

async function buildTestPdf(pageCount: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) doc.addPage([300, 300]);
  return doc.save();
}

async function sourceFile(name: string, pageCount: number): Promise<SourceFile> {
  const bytes = await buildTestPdf(pageCount);
  return { name, size: bytes.length, bytes };
}

describe("splitOneFile", () => {
  it("splits by page cut points and names parts after the source file", async () => {
    const source = await sourceFile("my-book.pdf", 10);
    const result = await splitOneFile(source, { kind: "pages", cutPoints: [4] });

    expect(result.status).toBe("split");
    expect(result.outputs).toHaveLength(2);
    expect(result.outputs[0].fileName).toContain("my-book");
    expect(result.outputs[0].pageRangeLabel).toBe("pages 1-4");
    expect(result.outputs[1].pageRangeLabel).toBe("pages 5-10");
  });

  it("splits by size, producing at least one part per page group under the cap", async () => {
    const source = await sourceFile("book.pdf", 5);
    const result = await splitOneFile(source, { kind: "size", maxBytes: 1024 * 1024 });

    expect(result.status).toBe("split");
    expect(result.outputs.length).toBeGreaterThan(0);
    const totalPages = result.outputs.reduce((sum, o) => sum + (o.pageRangeLabel.match(/\d+/g)?.length ?? 0), 0);
    expect(totalPages).toBeGreaterThan(0);
  });
});

describe("splitBatch", () => {
  it("skips files at or under the threshold and splits the rest", async () => {
    const small = await sourceFile("small.pdf", 1);
    const big = await sourceFile("big.pdf", 5);

    const results = await splitBatch([small, big], {
      maxBytes: 1024 * 1024,
      thresholdBytes: small.size,
    });

    const smallResult = results.find((r) => r.sourceName === "small.pdf")!;
    const bigResult = results.find((r) => r.sourceName === "big.pdf")!;

    expect(smallResult.status).toBe("skipped");
    expect(smallResult.outputs).toHaveLength(0);
    expect(bigResult.status).toBe("split");
    expect(bigResult.outputs.length).toBeGreaterThan(0);
  });

  it("preserves input order in the results", async () => {
    const files = await Promise.all([sourceFile("a.pdf", 2), sourceFile("b.pdf", 2), sourceFile("c.pdf", 2)]);
    const results = await splitBatch(files, { maxBytes: 1024 * 1024, thresholdBytes: 0 });
    expect(results.map((r) => r.sourceName)).toEqual(["a.pdf", "b.pdf", "c.pdf"]);
  });
});
