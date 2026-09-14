export { nodeFileSystem, findPdfFiles } from "./fsAdapter.js";

// CSV batch mode depends on csv-parse, which references Node-only globals
// (Buffer) at module load time, so it lives behind this Node-only entry
// point rather than the main one: a browser bundle that imports the main
// entry must never pull this module in, even transitively.
export {
  parseCsvBatch,
  resolveCsvBatchRows,
  resolveCsvBatchRowsOrErrors,
  CSV_TEMPLATE_CONTENT,
  DEFAULT_CSV_TEMPLATE_FILENAME,
} from "../csvBatch.js";
export type { CsvBatchRow, ResolvedCsvRow } from "../csvBatch.js";
