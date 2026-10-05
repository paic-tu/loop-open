import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function downloadCsv(
  rows: Array<Record<string, unknown>>,
  columns: Array<{ key: string; label: string }>,
  filename: string
): void {
  const header = columns.map((c) => escapeCsvCell(c.label)).join(",");
  const body = rows
    .map((row) =>
      columns
        .map((c) => {
          const raw = row[c.key];
          if (raw === null || raw === undefined) return escapeCsvCell("");
          if (raw instanceof Date) return escapeCsvCell(raw.toISOString());
          return escapeCsvCell(String(raw));
        })
        .join(",")
    )
    .join("\r\n");
  const csv = `${header}\r\n${body}`;
  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
