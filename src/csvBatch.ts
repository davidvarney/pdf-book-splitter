import { parse } from "csv-parse/sync";
import { parseSize } from "./size.js";
import { parseCutPoints } from "./pageRanges.js";
import type { SplitStrategy } from "./cliArgs.js";

export const DEFAULT_CSV_TEMPLATE_FILENAME = "pdf-book-splitter-template.csv";

export const CSV_TEMPLATE_CONTENT = `# pdf-book-splitter batch CSV
#
# Each row splits one PDF file. Required: "input", and exactly one of
# "size" or "split_at" (leave the other blank). "out" is optional.
#
#   input     Path to the PDF file. Relative paths are resolved relative
#             to this CSV file's own location, not the current directory.
#   size      Max size per output file, e.g. "25MB", "700KB", "1GB".
#   split_at  Page numbers to split after, e.g. "50,120,180" (on a
#             200-page file this makes parts covering pages 1-50, 51-120,
#             and 121-200). Quote the value since it contains commas, like
#             the example row below.
#   out       Output directory for this file's parts. Optional; defaults
#             to a folder named after the file, created next to it.
#
# Delete the example rows below and replace them with your own.
input,size,split_at,out
my-novel.pdf,25MB,,
my-textbook.pdf,,"50,120,300",
short-story.pdf,10MB,,custom-output-folder
`;

/** One data row of a batch CSV, before validating size/split_at into a strategy. */
export interface CsvBatchRow {
  /** 1-based index among data rows (comments and blank lines don't count). */
  rowNumber: number;
  input: string;
  size?: string;
  splitAt?: string;
  out?: string;
}

/** A CsvBatchRow with size/split_at resolved into a validated SplitStrategy. */
export interface ResolvedCsvRow {
  rowNumber: number;
  input: string;
  out?: string;
  strategy: SplitStrategy;
}

/**
 * Parses batch CSV text into rows. Lines starting with "#" are treated as
 * comments and skipped, so the template file's documentation doesn't need
 * to be stripped by the caller. Throws if the file has no "input" column.
 */
export function parseCsvBatch(csvContent: string): CsvBatchRow[] {
  let records: Record<string, string>[];
  try {
    records = parse(csvContent, {
      columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
      skip_empty_lines: true,
      trim: true,
      comment: "#",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Could not parse CSV: ${message}`);
  }

  if (records.length === 0) {
    return [];
  }

  if (!("input" in records[0])) {
    throw new Error('The CSV file is missing an "input" column.');
  }

  return records.map((record, index) => ({
    rowNumber: index + 1,
    input: record.input ?? "",
    size: record.size || undefined,
    splitAt: record.split_at || undefined,
    out: record.out || undefined,
  }));
}

/**
 * Validates every row's size/split_at into a SplitStrategy. Checks all rows
 * and never throws, so a caller that also needs to check other per-row
 * concerns (e.g. whether the input file exists) can combine every problem
 * into a single report instead of stopping at the first bad row.
 */
export function resolveCsvBatchRowsOrErrors(rows: CsvBatchRow[]): {
  resolved: ResolvedCsvRow[];
  errors: string[];
} {
  const errors: string[] = [];
  const resolved: ResolvedCsvRow[] = [];

  for (const row of rows) {
    const label = `Row ${row.rowNumber}${row.input ? ` (${row.input})` : ""}`;
    try {
      if (!row.input || row.input.trim() === "") {
        throw new Error('missing a required "input" value.');
      }
      if (row.size && row.splitAt) {
        throw new Error('specify either "size" or "split_at", not both.');
      }
      if (!row.size && !row.splitAt) {
        throw new Error('must specify either "size" or "split_at".');
      }

      const strategy: SplitStrategy = row.splitAt
        ? { kind: "pages", cutPoints: parseCutPoints(row.splitAt) }
        : { kind: "size", maxBytes: parseSize(row.size!) };

      resolved.push({ rowNumber: row.rowNumber, input: row.input, out: row.out, strategy });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${label}: ${message}`);
    }
  }

  return { resolved, errors };
}

/**
 * Same as resolveCsvBatchRowsOrErrors, but throws a single combined error
 * (covering every invalid row) instead of returning the error list.
 */
export function resolveCsvBatchRows(rows: CsvBatchRow[]): ResolvedCsvRow[] {
  const { resolved, errors } = resolveCsvBatchRowsOrErrors(rows);
  if (errors.length > 0) {
    throw new Error(`Invalid batch CSV:\n${errors.map((e) => `  - ${e}`).join("\n")}`);
  }
  return resolved;
}
