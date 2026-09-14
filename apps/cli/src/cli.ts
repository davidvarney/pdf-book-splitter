#!/usr/bin/env node
import { Command } from "commander";
import { readFile, writeFile, mkdir, access, stat } from "node:fs/promises";
import { createInterface, type Interface } from "node:readline";
import path from "node:path";
import {
  splitPdfBySize,
  splitPdfByPageRanges,
  getPdfPageCount,
  buildPartFileName,
  formatSize,
  partitionByThreshold,
  parseCutPoints,
  parseCsvBatch,
  resolveCsvBatchRowsOrErrors,
  CSV_TEMPLATE_CONTENT,
  DEFAULT_CSV_TEMPLATE_FILENAME,
  type SplitPart,
  type ScannedFile,
} from "@pdf-book-splitter/core";
import { findPdfFiles } from "@pdf-book-splitter/core/node";
import { resolveSplitInvocation, type SplitStrategy } from "./cliArgs.js";

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
  .option("-s, --size <size>", 'max size per output file, e.g. "50MB", "700KB", "1GB" (see "Size format" below)')
  .option(
    "-p, --split-at <pages>",
    'split a single file at specific pages instead of by size, e.g. "50,120,180" (see "Page format" below)'
  )
  .option("-d, --dir <directory>", "scan this directory instead of a single file, and split every PDF in it larger than the threshold")
  .option(
    "-t, --threshold <size>",
    "with --dir, only split files larger than this size (default: same as --size)"
  )
  .option(
    "-i, --interactive",
    "with --dir, ask for page numbers before splitting each oversized file, instead of always splitting by size"
  )
  .option(
    "-o, --out <dir>",
    "output directory (default: a folder named after each source file, created next to it); " +
      "with --dir or --csv, used as the root that each source file's own-named folder is created under"
  )
  .option(
    "-c, --csv <file>",
    "batch-process the files listed in this CSV (see --csv-template for the format)"
  )
  .option(
    "--csv-template [path]",
    `write a template batch CSV to this path (default: "${DEFAULT_CSV_TEMPLATE_FILENAME}") and exit, ` +
      "ignoring any other options"
  )
  .addHelpText(
    "after",
    `
Size format:
  A number optionally followed by a unit: B, KB, MB, or GB (case-insensitive,
  binary/1024-based). No unit means bytes. Examples: 700KB, 25MB, 1.5GB, 25 MB.

Page format:
  A comma-separated list of pages to split after, e.g. "50,120". On a
  200-page file that produces parts covering pages 1-50, 51-120, 121-200.

Examples:
  Split one file into 25MB parts:
    $ pdf-book-splitter split ~/Books/my-novel.pdf --size 25MB

  Split one file at specific pages instead of by size:
    $ pdf-book-splitter split ~/Books/my-novel.pdf --split-at 50,120,180

  Split one file into a specific output folder:
    $ pdf-book-splitter split ~/Books/my-novel.pdf --size 25MB --out ~/Desktop/my-novel-parts

  Split every PDF over 25MB found directly inside a folder:
    $ pdf-book-splitter split --dir ~/Books --size 25MB

  Same, but only split files bigger than 100MB (still capping parts at 25MB):
    $ pdf-book-splitter split --dir ~/Books --size 25MB --threshold 100MB

  Scan a folder and ask for page numbers before splitting each oversized file:
    $ pdf-book-splitter split --dir ~/Books --size 25MB --interactive

  Write a template CSV to fill in, then batch-process the files it lists:
    $ pdf-book-splitter split --csv-template
    $ pdf-book-splitter split --csv ./pdf-book-splitter-template.csv`
  )
  .action(
    async (
      inputArg: string | undefined,
      opts: {
        size?: string;
        splitAt?: string;
        dir?: string;
        threshold?: string;
        interactive?: boolean;
        out?: string;
        csv?: string;
        csvTemplate?: string | boolean;
      }
    ) => {
      try {
        if (opts.csvTemplate) {
          await runCsvTemplate(typeof opts.csvTemplate === "string" ? opts.csvTemplate : undefined);
          return;
        }
        await runSplitCommand(inputArg, opts);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${message}`);
        process.exitCode = 1;
      }
    }
  );

async function runCsvTemplate(targetPathArg: string | undefined): Promise<void> {
  const targetPath = path.resolve(targetPathArg ?? DEFAULT_CSV_TEMPLATE_FILENAME);

  const exists = await access(targetPath).then(
    () => true,
    () => false
  );
  if (exists) {
    throw new Error(`Refusing to overwrite existing file: ${targetPath}. Choose a different path or remove it first.`);
  }

  await writeFile(targetPath, CSV_TEMPLATE_CONTENT, "utf8");
  console.log(`Wrote batch CSV template to "${targetPath}".`);
  console.log(`Fill it in, then run: pdf-book-splitter split --csv "${targetPath}"`);
}

async function runSplitCommand(
  inputArg: string | undefined,
  opts: {
    size?: string;
    splitAt?: string;
    dir?: string;
    threshold?: string;
    interactive?: boolean;
    out?: string;
    csv?: string;
  }
): Promise<void> {
  const invocation = resolveSplitInvocation(inputArg, opts);

  if (invocation.mode === "dir") {
    await runDirectorySplit(invocation.dirPath, {
      maxBytes: invocation.maxBytes,
      thresholdBytes: invocation.thresholdBytes,
      outRoot: invocation.outRoot,
      interactive: invocation.interactive,
    });
  } else if (invocation.mode === "csv") {
    await runCsvBatchSplit(invocation.csvPath, { outRoot: invocation.outRoot });
  } else {
    const inputPath = path.resolve(invocation.inputPath);
    await assertFileReadable(inputPath);

    const baseName = path.basename(inputPath, path.extname(inputPath));
    const outDir = path.resolve(invocation.outDir ?? path.join(path.dirname(inputPath), baseName));

    await splitOneFile(inputPath, baseName, outDir, invocation.strategy);
  }
}

async function runCsvBatchSplit(csvArg: string, opts: { outRoot?: string }): Promise<void> {
  const csvPath = path.resolve(csvArg);
  await assertFileReadable(csvPath);

  const csvContent = await readFile(csvPath, "utf8");
  const rawRows = parseCsvBatch(csvContent);
  if (rawRows.length === 0) {
    throw new Error(`The CSV file has no data rows to process: ${csvPath}`);
  }
  const { resolved: rows, errors } = resolveCsvBatchRowsOrErrors(rawRows);

  const csvDir = path.dirname(csvPath);
  const prepared: { rowNumber: number; label: string; inputPath: string; outDir: string; baseName: string; strategy: SplitStrategy }[] =
    [];

  // Only check file existence for rows whose strategy already validated;
  // an invalid row is already reported without needing to touch the disk.
  for (const row of rows) {
    const inputPath = path.resolve(csvDir, row.input);
    try {
      await assertFileReadable(inputPath);
    } catch {
      errors.push(`Row ${row.rowNumber} (${row.input}): file not found at "${inputPath}".`);
      continue;
    }

    const baseName = path.basename(inputPath, path.extname(inputPath));
    const outDir = row.out
      ? path.resolve(csvDir, row.out)
      : path.resolve(opts.outRoot ? path.join(opts.outRoot, baseName) : path.join(path.dirname(inputPath), baseName));

    prepared.push({ rowNumber: row.rowNumber, label: row.input, inputPath, outDir, baseName, strategy: row.strategy });
  }

  if (errors.length > 0) {
    const rowNumberOf = (message: string) => Number(/^Row (\d+)/.exec(message)?.[1] ?? 0);
    const sorted = [...errors].sort((a, b) => rowNumberOf(a) - rowNumberOf(b));
    throw new Error(`Invalid batch CSV:\n${sorted.map((e) => `  - ${e}`).join("\n")}`);
  }

  console.log(`Processing ${prepared.length} file(s) listed in "${csvPath}"...`);

  for (const file of prepared) {
    console.log(`\nRow ${file.rowNumber}: splitting "${file.label}"...`);
    await splitOneFile(file.inputPath, file.baseName, file.outDir, file.strategy);
  }

  console.log(`\nDone. Split ${prepared.length} file(s) listed in "${csvPath}".`);
}

async function runDirectorySplit(
  dirArg: string,
  opts: { maxBytes: number; thresholdBytes: number; outRoot?: string; interactive: boolean }
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

  const lineReader = opts.interactive ? createLineReader() : undefined;

  try {
    for (const file of toSplit) {
      const baseName = path.basename(file.fileName, path.extname(file.fileName));
      const outDir = path.resolve(
        opts.outRoot ? path.join(opts.outRoot, baseName) : path.join(dirPath, baseName)
      );

      console.log(`\nSplitting "${file.fileName}" (${formatSize(file.size)})...`);

      const strategy = lineReader
        ? await promptForStrategy(lineReader, file, opts.maxBytes)
        : ({ kind: "size", maxBytes: opts.maxBytes } satisfies SplitStrategy);

      await splitOneFile(file.filePath, baseName, outDir, strategy);
    }
  } finally {
    lineReader?.close();
  }

  console.log(`\nDone. Split ${toSplit.length} file(s), skipped ${skipped.length} file(s).`);
}

interface LineReader {
  /** Resolves with the next line of input, or null if input has ended. */
  next(): Promise<string | null>;
  close(): void;
}

/**
 * Wraps readline in a queue so lines are captured as soon as they arrive,
 * regardless of when next() is called. Using rl.question() directly is
 * racy here: any await between creating the interface and asking (e.g.
 * reading a file to report its page count) lets a 'line' event fire and be
 * discarded before anything is listening for it, which is exactly what
 * happens with piped/redirected input (a live typing user can't outrace
 * their own prompt, but piped input arrives all at once).
 */
function createLineReader(): LineReader {
  const rl: Interface = createInterface({ input: process.stdin, output: process.stdout });
  const queue: string[] = [];
  const waiters: Array<(line: string | null) => void> = [];
  let ended = false;

  rl.on("line", (line) => {
    const waiter = waiters.shift();
    if (waiter) waiter(line);
    else queue.push(line);
  });
  rl.on("close", () => {
    ended = true;
    while (waiters.length > 0) waiters.shift()!(null);
  });

  return {
    next(): Promise<string | null> {
      if (queue.length > 0) return Promise.resolve(queue.shift()!);
      if (ended) return Promise.resolve(null);
      return new Promise((resolve) => waiters.push(resolve));
    },
    close(): void {
      rl.close();
    },
  };
}

async function promptForStrategy(
  lineReader: LineReader,
  file: ScannedFile,
  defaultMaxBytes: number
): Promise<SplitStrategy> {
  const sourceBytes = await readFile(file.filePath);
  const pageCount = await getPdfPageCount(new Uint8Array(sourceBytes));

  for (;;) {
    process.stdout.write(
      `  "${file.fileName}" has ${pageCount} pages. Enter page numbers to split after ` +
        `(e.g. "50,120"), or press Enter to split automatically into ${formatSize(defaultMaxBytes)} parts: `
    );

    const answer = await lineReader.next();

    if (answer === null) {
      // No more input to read (e.g. piped input ended); fall back rather
      // than fail the rest of the batch.
      console.log("(no more input; splitting automatically by size)");
      return { kind: "size", maxBytes: defaultMaxBytes };
    }

    if (answer.trim() === "") {
      return { kind: "size", maxBytes: defaultMaxBytes };
    }

    try {
      const cutPoints = parseCutPoints(answer);
      for (const cutPoint of cutPoints) {
        if (cutPoint >= pageCount) {
          throw new Error(
            `Invalid split point ${cutPoint}: must be between 1 and ${pageCount - 1} ` +
              `for this ${pageCount}-page file.`
          );
        }
      }
      return { kind: "pages", cutPoints };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  ${message} Please try again.`);
    }
  }
}

async function splitOneFile(
  inputPath: string,
  baseName: string,
  outDir: string,
  strategy: SplitStrategy
): Promise<void> {
  await mkdir(outDir, { recursive: true });
  const sourceBytes = new Uint8Array(await readFile(inputPath));

  let parts: SplitPart[];
  let warnings: string[] = [];

  if (strategy.kind === "size") {
    const result = await splitPdfBySize(sourceBytes, {
      maxBytes: strategy.maxBytes,
      onProgress: (done, total) => {
        process.stdout.write(`\rProcessing page ${done}/${total}`);
      },
    });
    parts = result.parts;
    warnings = result.warnings;
    process.stdout.write("\n");
  } else {
    const result = await splitPdfByPageRanges(sourceBytes, strategy.cutPoints);
    parts = result.parts;
  }

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
