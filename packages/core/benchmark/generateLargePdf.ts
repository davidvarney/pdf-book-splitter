// Generates a synthetic large PDF (many pages, each with a unique
// random-noise image so pages can't share/dedupe an embedded resource) to
// exercise the memory/time risk flagged in docs/platform-release-plan.md:
// pdf-lib holds the whole document in memory, which needs checking against
// a realistically large (500+ page, 500MB+) book before it's relied on by
// every future GUI shell, especially memory-constrained mobile WebViews.
//
// Usage: tsx benchmark/generateLargePdf.ts [pageCount] [imageSidePx] [outPath]
import { PDFDocument } from "pdf-lib";
import { deflateSync, crc32 } from "node:zlib";
import { randomBytes } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcValue = crc32(Buffer.concat([typeBuf, data])) >>> 0;
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcValue, 0);
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

/** Builds a valid, minimal 8-bit RGB PNG filled with random noise (so it can't compress away). */
function buildRandomPng(width: number, height: number): Buffer {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter type: None
    randomBytes(stride).copy(raw, rowStart + 1);
  }
  const idat = deflateSync(raw);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor (RGB)
  ihdr[10] = 0; // compression method
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace method

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

async function main(): Promise<void> {
  const pageCount = Number(process.argv[2] ?? 550);
  const imageSide = Number(process.argv[3] ?? 620);
  const outPath = path.resolve(
    process.argv[4] ?? path.join(import.meta.dirname, ".fixtures", "large-benchmark.pdf")
  );

  await mkdir(path.dirname(outPath), { recursive: true });

  console.log(
    `Generating a ${pageCount}-page PDF, each page a unique ${imageSide}x${imageSide} ` +
      `random-noise image (so pages can't dedupe a shared resource)...`
  );

  const doc = await PDFDocument.create();
  const start = Date.now();

  for (let i = 0; i < pageCount; i++) {
    const png = buildRandomPng(imageSide, imageSide);
    const image = await doc.embedPng(png);
    const page = doc.addPage([imageSide, imageSide]);
    page.drawImage(image, { x: 0, y: 0, width: imageSide, height: imageSide });

    if ((i + 1) % 50 === 0 || i + 1 === pageCount) {
      console.log(`  ${i + 1}/${pageCount} pages built (${((Date.now() - start) / 1000).toFixed(1)}s elapsed)`);
    }
  }

  console.log("Serializing...");
  const bytes = await doc.save();
  await writeFile(outPath, bytes);

  console.log(`\nWrote ${(bytes.length / 1024 / 1024).toFixed(1)} MB across ${pageCount} pages to:\n  ${outPath}`);
  console.log(`Total generation time: ${((Date.now() - start) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
