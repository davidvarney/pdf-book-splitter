import { useRef, useState, type DragEvent } from "react";
import { isTauri, pickFilesViaDialog } from "../lib/platform.js";
import type { SourceFile } from "../lib/splitRunner.js";

interface DropzoneProps {
  multiple: boolean;
  disabled: boolean;
  onFiles: (files: SourceFile[]) => void;
}

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

async function toSourceFile(file: File): Promise<SourceFile> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return { name: file.name, size: file.size, bytes };
}

export function Dropzone({ multiple, disabled, onFiles }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const nativeShell = isTauri();

  async function acceptBrowserFiles(fileList: FileList | null) {
    if (!fileList) return;
    const pdfFiles = Array.from(fileList).filter(isPdf);
    if (pdfFiles.length === 0) return;
    const chosen = multiple ? pdfFiles : [pdfFiles[0]];
    onFiles(await Promise.all(chosen.map(toSourceFile)));
  }

  async function handleClick() {
    if (disabled) return;
    if (nativeShell) {
      const files = await pickFilesViaDialog(multiple);
      if (files.length > 0) onFiles(files);
    } else {
      inputRef.current?.click();
    }
  }

  return (
    <div
      className={`dropzone${isDragOver ? " dropzone--active" : ""}${disabled ? " dropzone--disabled" : ""}`}
      onClick={handleClick}
      onDragOver={(e: DragEvent) => {
        if (nativeShell) return;
        e.preventDefault();
        if (!disabled) setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e: DragEvent) => {
        if (nativeShell) return;
        e.preventDefault();
        setIsDragOver(false);
        if (!disabled) void acceptBrowserFiles(e.dataTransfer.files);
      }}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
    >
      <p>
        Drag {multiple ? "PDF files" : "a PDF file"} here, or click to choose{multiple ? "" : " a file"}.
      </p>
      {!nativeShell && (
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple={multiple}
          hidden
          disabled={disabled}
          onChange={(e) => {
            void acceptBrowserFiles(e.target.files);
            e.target.value = "";
          }}
        />
      )}
    </div>
  );
}
