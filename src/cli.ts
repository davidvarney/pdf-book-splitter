#!/usr/bin/env node
import { Command } from "commander";
import { readFile, writeFile, mkdir, access, stat } from "node:fs/promises";
import path from "node:path";
import { splitPdfBySize } from "./split.js";
import { buildPartFileName } from "./naming.js";
import { formatSize } from "./size.js";
import { findPdfFiles, partitionByThreshold } from "./batch.js";
import { resolveSplitInvocation } from "./cliArgs.js";

const program = new Command();

program
  .name("pdf-book-splitter")
  .description("Split a PDF book into multiple files no larger than a target size, without splitting pages.")
  .version("0.1.0")
  .addHelpText(
    "after",
    `
Run "pdf-book-splitter split --help" for the split command's options and examples.`
  );

program
  .command("split")
  .description("Split a single PDF, or every oversized PDF in a directory, into parts")
  .argument("[input]", "path to a single source PDF file (omit this when using --dir)")
  .requiredOption("-s, --size <size>", 'max size per output file, e.g. "50MB", "700KB", "1GB" (see "Size format" below)')
  .option("-d, --dir <directory>", "scan this directory instead of a single file, and split every PDF in it larger than the threshold")
  .option(
    "-t, --threshold <size>",
    "with --dir, only split files larger than this size (default: same as --size)"
  )
  .option(
    "-o, --out <dir>",
    "output directory (default: a folder named after each source file, created next to it); " +
      "with --dir, used as the root that each source file's own-named folder is created under"
  )
  .addHelpText(
    "after",
    `
Size format:
  A number optionally followed by a unit: B, KB, MB, or GB (case-insensitive,
  binary/1024-based). No unit means bytes. Examples: 700KB, 25MB, 1.5GB, 25 MB.

Examples:
  Split one file into 25MB parts:
    $ pdf-book-splitter split ~/Books/my-novel.pdf --size 25MB

  Split one file into a specific output folder:
    $ pdf-book-splitter split ~/Books/my-novel.pdf --size 25MB --out ~/Desktop/my-novel-parts

  Split every PDF over 25MB found directly inside a folder:
    $ pdf-book-splitter split --dir ~/Books --size 25MB

  Same, but only split files bigger than 100MB (still capping parts at 25MB):
    $ pdf-book-splitter split --dir ~/Books --size 25MB --threshold 100MB`
  )
  .action(async (inputArg: string | undefined, opts: { size: string; dir?: string; threshold?: string; out?: string }) => {
    try {
      await runSplitCommand(inputArg, opts);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${message}`);
      process.exitCode = 1;
    }
  });

async function runSplitCommand(
  inputArg: string | undefined,
  opts: { size: string; dir?: string; threshold?: string; out?: string }
): Promise<void> {
  const invocation = resolveSplitInvocation(inputArg, opts);

  if (invocation.mode === "dir") {
    await runDirectorySplit(invocation.dirPath, {
      maxBytes: invocation.maxBytes,
      thresholdBytes: invocation.thresholdBytes,
      outRoot: invocation.outRoot,
    });
  } else {
    await runSingleFileSplit(invocation.inputPath, {
      maxBytes: invocation.maxBytes,
      outDir: invocation.outDir,
    });
  }
}

async function runSingleFileSplit(
  inputArg: string,
  opts: { maxBytes: number; outDir?: string }
): Promise<void> {
  const inputPath = path.resolve(inputArg);
  await assertFileReadable(inputPath);

  const baseName = path.basename(inputPath, path.extname(inputPath));
  const outDir = path.resolve(opts.outDir ?? path.join(path.dirname(inputPath), baseName));

  await splitOneFile(inputPath, baseName, outDir, opts.maxBytes);
}

async function runDirectorySplit(
  dirArg: string,
  opts: { maxBytes: number; thresholdBytes: number; outRoot?: string }
): Promise<void> {
  const dirPath = path.resolve(dirArg);
  await assertDirectory(dirPath);

  const files = await findPdfFiles(dirPath);
  if (files.length === 0) {
    console.log(`No PDF files found in "${dirPath}".`);
    return;
  }

  const { toSplit, skipped } = partitionByThreshold(files, opts.thresholdBytes);

  console.log(
    `Found ${files.length} PDF file(s) in "${dirPath}". ` +
      `Splitting ${toSplit.length} file(s) larger than ${formatSize(opts.thresholdBytes)}, ` +
      `skipping ${skipped.length}.\n`
  );

  for (const file of skipped) {
    console.log(`Skipping "${file.fileName}" (${formatSize(file.size)}, at or under the threshold).`);
  }

  for (const file of toSplit) {
    const baseName = path.basename(file.fileName, path.extname(file.fileName));
    const outDir = path.resolve(
      opts.outRoot ? path.join(opts.outRoot, baseName) : path.join(dirPath, baseName)
    );
    console.log(`\nSplitting "${file.fileName}" (${formatSize(file.size)})...`);
    await splitOneFile(file.filePath, baseName, outDir, opts.maxBytes);
  }

  console.log(`\nDone. Split ${toSplit.length} file(s), skipped ${skipped.length} file(s).`);
}

async function splitOneFile(
  inputPath: string,
  baseName: string,
  outDir: string,
  maxBytes: number
): Promise<void> {
  await mkdir(outDir, { recursive: true });
  const sourceBytes = await readFile(inputPath);

  const { parts, warnings } = await splitPdfBySize(new Uint8Array(sourceBytes), {
    maxBytes,
    onProgress: (done, total) => {
      process.stdout.write(`\rProcessing page ${done}/${total}`);
    },
  });
  process.stdout.write("\n");

  const totalParts = parts.length;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const fileName = buildPartFileName(baseName, i + 1, totalParts);
    const filePath = path.join(outDir, fileName);
    await writeFile(filePath, part.bytes);
    const pageRange =
      part.pageIndices.length === 1
        ? `page ${part.pageIndices[0] + 1}`
        : `pages ${part.pageIndices[0] + 1}-${part.pageIndices[part.pageIndices.length - 1] + 1}`;
    console.log(`  ${fileName}  (${pageRange}, ${formatSize(part.bytes.length)})`);
  }

  if (warnings.length > 0) {
    console.log("  Warnings:");
    for (const warning of warnings) {
      console.log(`    - ${warning}`);
    }
  }

  console.log(`  Wrote ${totalParts} file(s) to "${outDir}".`);
}

async function assertFileReadable(filePath: string): Promise<void> {
  try {
    await access(filePath);
  } catch {
    throw new Error(`Input file not found: ${filePath}`);
  }
  const info = await stat(filePath);
  if (!info.isFile()) {
    throw new Error(`Input path is not a file: ${filePath}`);
  }
}

async function assertDirectory(dirPath: string): Promise<void> {
  let info;
  try {
    info = await stat(dirPath);
  } catch {
    throw new Error(`Directory not found: ${dirPath}`);
  }
  if (!info.isDirectory()) {
    throw new Error(`--dir path is not a directory: ${dirPath}`);
  }
}

program.parseAsync(process.argv);
