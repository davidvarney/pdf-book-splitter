const UNIT_MULTIPLIERS: Record<string, number> = {
  B: 1,
  KB: 1024,
  MB: 1024 ** 2,
  GB: 1024 ** 3,
};

const SIZE_PATTERN = /^\s*([0-9]*\.?[0-9]+)\s*(B|KB|MB|GB)?\s*$/i;

/**
 * Parses a human-entered size string (e.g. "50MB", "700KB", "1.5GB", or a
 * plain byte count like "1048576") into a whole number of bytes.
 */
export function parseSize(input: string): number {
  const match = SIZE_PATTERN.exec(input);
  if (!match) {
    throw new Error(
      `Invalid size "${input}". Expected a number optionally followed by B, KB, MB, or GB (e.g. "50MB").`
    );
  }

  const [, numberPart, unitPart] = match;
  const unit = (unitPart ?? "B").toUpperCase();
  const value = Number.parseFloat(numberPart);
  const bytes = Math.floor(value * UNIT_MULTIPLIERS[unit]);

  if (!Number.isFinite(bytes) || bytes <= 0) {
    throw new Error(`Invalid size "${input}". Size must be a positive number.`);
  }

  return bytes;
}

/** Formats a byte count as a human-readable string, e.g. "12.3 MB". */
export function formatSize(bytes: number): string {
  const units: [string, number][] = [
    ["GB", UNIT_MULTIPLIERS.GB],
    ["MB", UNIT_MULTIPLIERS.MB],
    ["KB", UNIT_MULTIPLIERS.KB],
  ];

  for (const [unit, size] of units) {
    if (bytes >= size) {
      return `${(bytes / size).toFixed(1)} ${unit}`;
    }
  }

  return `${bytes} B`;
}
