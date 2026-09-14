import { useState } from "react";
import { parseSize, parseCutPoints, formatSize } from "@pdf-book-splitter/core";
import { Dropzone } from "./components/Dropzone.js";
import { ResultsList } from "./components/ResultsList.js";
import { splitBatch, splitOneFile, type FileSplitResult, type SourceFile } from "./lib/splitRunner.js";

type Mode = "single" | "batch";
type SingleStrategyKind = "size" | "pages";

async function toSourceFile(file: File): Promise<SourceFile> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return { name: file.name, size: file.size, bytes };
}

export function App() {
  const [mode, setMode] = useState<Mode>("single");
  const [singleStrategyKind, setSingleStrategyKind] = useState<SingleStrategyKind>("size");
  const [files, setFiles] = useState<File[]>([]);
  const [sizeText, setSizeText] = useState("25MB");
  const [cutPointsText, setCutPointsText] = useState("");
  const [thresholdText, setThresholdText] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [results, setResults] = useState<FileSplitResult[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function selectMode(next: Mode) {
    setMode(next);
    setFiles([]);
    setResults([]);
    setErrorMessage(null);
    setLogLines([]);
  }

  function log(line: string) {
    setLogLines((prev) => [...prev, line]);
  }

  async function handleRun() {
    setErrorMessage(null);
    setResults([]);
    setLogLines([]);

    if (files.length === 0) {
      setErrorMessage("Choose a PDF file first.");
      return;
    }

    let maxBytes: number;
    try {
      maxBytes = parseSize(sizeText);
    } catch (err) {
      setErrorMessage((err as Error).message);
      return;
    }

    setIsRunning(true);
    try {
      if (mode === "single") {
        const source = await toSourceFile(files[0]);
        log(`Reading "${source.name}" (${formatSize(source.size)})...`);

        if (singleStrategyKind === "size") {
          log(`Splitting into parts no larger than ${formatSize(maxBytes)}...`);
          const result = await splitOneFile(source, { kind: "size", maxBytes }, (done, total) =>
            log(`  page ${done}/${total}`)
          );
          setResults([result]);
        } else {
          let cutPoints: number[];
          try {
            cutPoints = parseCutPoints(cutPointsText);
          } catch (err) {
            setErrorMessage((err as Error).message);
            return;
          }
          log(`Splitting at pages ${cutPoints.join(", ")}...`);
          const result = await splitOneFile(source, { kind: "pages", cutPoints });
          setResults([result]);
        }
      } else {
        let thresholdBytes = maxBytes;
        if (thresholdText.trim() !== "") {
          try {
            thresholdBytes = parseSize(thresholdText);
          } catch (err) {
            setErrorMessage((err as Error).message);
            return;
          }
        }

        const sources = await Promise.all(files.map(toSourceFile));
        log(`Splitting ${sources.length} file(s), skipping any at or under ${formatSize(thresholdBytes)}...`);
        const batchResults = await splitBatch(sources, { maxBytes, thresholdBytes }, (fileName, done, total) =>
          log(`  ${fileName}: page ${done}/${total}`)
        );
        setResults(batchResults);
      }
      log("Done.");
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <main className="app">
      <h1>PDF Book Splitter</h1>
      <p className="app__subtitle">
        Split a PDF into smaller files by size or by page number &mdash; entirely in your browser. Nothing is
        uploaded to a server.
      </p>

      <div className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={mode === "single"}
          className={mode === "single" ? "tab tab--active" : "tab"}
          onClick={() => selectMode("single")}
        >
          Single file
        </button>
        <button
          role="tab"
          aria-selected={mode === "batch"}
          className={mode === "batch" ? "tab tab--active" : "tab"}
          onClick={() => selectMode("batch")}
        >
          Multiple files
        </button>
      </div>

      <Dropzone multiple={mode === "batch"} disabled={isRunning} onFiles={setFiles} />

      {files.length > 0 && (
        <ul className="selected-files">
          {files.map((file) => (
            <li key={file.name}>
              {file.name} ({formatSize(file.size)})
            </li>
          ))}
        </ul>
      )}

      {mode === "single" && (
        <fieldset className="controls">
          <legend>Split by</legend>
          <label>
            <input
              type="radio"
              name="single-strategy"
              checked={singleStrategyKind === "size"}
              onChange={() => setSingleStrategyKind("size")}
            />
            Size
          </label>
          <label>
            <input
              type="radio"
              name="single-strategy"
              checked={singleStrategyKind === "pages"}
              onChange={() => setSingleStrategyKind("pages")}
            />
            Page numbers
          </label>

          {singleStrategyKind === "size" ? (
            <label className="controls__field">
              Max size per file
              <input
                type="text"
                value={sizeText}
                onChange={(e) => setSizeText(e.target.value)}
                placeholder="e.g. 25MB"
              />
            </label>
          ) : (
            <label className="controls__field">
              Split after pages
              <input
                type="text"
                value={cutPointsText}
                onChange={(e) => setCutPointsText(e.target.value)}
                placeholder="e.g. 50,120,180"
              />
            </label>
          )}
        </fieldset>
      )}

      {mode === "batch" && (
        <fieldset className="controls">
          <legend>Split by size</legend>
          <label className="controls__field">
            Max size per output file
            <input
              type="text"
              value={sizeText}
              onChange={(e) => setSizeText(e.target.value)}
              placeholder="e.g. 25MB"
            />
          </label>
          <label className="controls__field">
            Only split files larger than (optional, defaults to max size above)
            <input
              type="text"
              value={thresholdText}
              onChange={(e) => setThresholdText(e.target.value)}
              placeholder="e.g. 100MB"
            />
          </label>
        </fieldset>
      )}

      <button className="run-button" onClick={handleRun} disabled={isRunning || files.length === 0}>
        {isRunning ? "Splitting..." : "Split"}
      </button>

      {errorMessage && <p className="error">{errorMessage}</p>}

      {logLines.length > 0 && <pre className="log">{logLines.join("\n")}</pre>}

      <ResultsList results={results} />
    </main>
  );
}
