function pushField(row: string[], value: string) {
  row.push(value.trim());
}

function pushRow(rows: string[][], row: string[], value: string) {
  pushField(row, value);
  if (row.some((cell) => cell.length > 0)) {
    rows.push(row);
  }
}

// Parse full CSV text, respecting double-quoted fields that may contain commas or line breaks.
export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  const normalized = text.replace(/^\uFEFF/, "");

  let currentField = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];

    if (inQuotes) {
      if (ch === '"') {
        if (normalized[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      pushField(currentRow, currentField);
      currentField = "";
      continue;
    }

    if (ch === "\n") {
      pushRow(rows, currentRow, currentField);
      currentRow = [];
      currentField = "";
      continue;
    }

    if (ch !== "\r") {
      currentField += ch;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    pushRow(rows, currentRow, currentField);
  }

  return rows;
}

// Parse a single CSV line, respecting double-quoted fields that may contain commas.
export function parseCsvLine(line: string): string[] {
  return parseCsvText(line)[0] ?? [];
}

export function splitClassNames(value?: string | null): string[] {
  const trimmed = value?.trim();
  if (!trimmed) return [];

  const unwrapped = trimmed.startsWith('"') && trimmed.endsWith('"')
    ? trimmed.slice(1, -1).replace(/""/g, '"')
    : trimmed;

  return unwrapped
    .split(",")
    .map((className) => className.trim())
    .filter(Boolean);
}
