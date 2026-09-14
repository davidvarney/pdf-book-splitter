import { splitPdfBySize, parseSize, formatSize, buildPartFileName } from "../../packages/core/src/index.js";

const fileInput = document.querySelector<HTMLInputElement>("#file")!;
const sizeInput = document.querySelector<HTMLInputElement>("#size")!;
const runButton = document.querySelector<HTMLButtonElement>("#run")!;
const log = document.querySelector<HTMLPreElement>("#log")!;
const results = document.querySelector<HTMLUListElement>("#results")!;

function print(line: string): void {
  log.textContent += `${line}\n`;
}

runButton.addEventListener("click", async () => {
  results.innerHTML = "";
  log.textContent = "";

  const file = fileInput.files?.[0];
  if (!file) {
    print("Choose a PDF file first.");
    return;
  }

  let maxBytes: number;
  try {
    maxBytes = parseSize(sizeInput.value);
  } catch (err) {
    print(`Invalid size: ${(err as Error).message}`);
    return;
  }

  print(`Reading "${file.name}" (${formatSize(file.size)})...`);
  const sourceBytes = new Uint8Array(await file.arrayBuffer());

  print("Splitting entirely in the browser (no server upload, no Node APIs)...");
  const { parts, warnings } = await splitPdfBySize(sourceBytes, {
    maxBytes,
    onProgress: (done, total) => print(`  page ${done}/${total}`),
  });

  const baseName = file.name.replace(/\.pdf$/i, "");
  for (const [i, part] of parts.entries()) {
    const fileName = buildPartFileName(baseName, i + 1, parts.length);
    const blob = new Blob([part.bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.textContent = `${fileName} (${formatSize(part.bytes.length)})`;
    li.appendChild(a);
    results.appendChild(li);
  }

  for (const warning of warnings) print(`Warning: ${warning}`);
  print(`Done. ${parts.length} part(s) produced.`);
});
