import { useRef, useState, type DragEvent } from "react";

interface DropzoneProps {
  multiple: boolean;
  disabled: boolean;
  onFiles: (files: File[]) => void;
}

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function Dropzone({ multiple, disabled, onFiles }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  function acceptFiles(fileList: FileList | null) {
    if (!fileList) return;
    const pdfFiles = Array.from(fileList).filter(isPdf);
    if (pdfFiles.length > 0) onFiles(multiple ? pdfFiles : [pdfFiles[0]]);
  }

  return (
    <div
      className={`dropzone${isDragOver ? " dropzone--active" : ""}${disabled ? " dropzone--disabled" : ""}`}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e: DragEvent) => {
        e.preventDefault();
        if (!disabled) setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e: DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        if (!disabled) acceptFiles(e.dataTransfer.files);
      }}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
    >
      <p>
        Drag {multiple ? "PDF files" : "a PDF file"} here, or click to choose{multiple ? "" : " a file"}.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple={multiple}
        hidden
        disabled={disabled}
        onChange={(e) => {
          acceptFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
