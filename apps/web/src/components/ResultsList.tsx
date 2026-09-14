import { useEffect, useMemo } from "react";
import { formatSize } from "@pdf-book-splitter/core";
import type { FileSplitResult } from "../lib/splitRunner.js";

interface ResultsListProps {
  results: FileSplitResult[];
}

export function ResultsList({ results }: ResultsListProps) {
  const urlsByOutput = useMemo(() => {
    const map = new Map<string, string>();
    for (const result of results) {
      for (const output of result.outputs) {
        const blob = new Blob([new Uint8Array(output.bytes)], { type: "application/pdf" });
        map.set(`${result.sourceName}::${output.fileName}`, URL.createObjectURL(blob));
      }
    }
    return map;
  }, [results]);

  useEffect(() => {
    return () => {
      for (const url of urlsByOutput.values()) URL.revokeObjectURL(url);
    };
  }, [urlsByOutput]);

  if (results.length === 0) return null;

  return (
    <div className="results">
      {results.map((result) => (
        <div className="results__source" key={result.sourceName}>
          <h3>{result.sourceName}</h3>
          {result.status === "skipped" ? (
            <p className="results__skipped">Skipped (at or under the threshold).</p>
          ) : (
            <>
              <ul>
                {result.outputs.map((output) => (
                  <li key={output.fileName}>
                    <a href={urlsByOutput.get(`${result.sourceName}::${output.fileName}`)} download={output.fileName}>
                      {output.fileName}
                    </a>
                    <span className="results__meta">
                      {" "}
                      ({output.pageRangeLabel}, {formatSize(output.bytes.length)})
                    </span>
                  </li>
                ))}
              </ul>
              {result.warnings.map((warning, i) => (
                <p className="results__warning" key={i}>
                  Warning: {warning}
                </p>
              ))}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
