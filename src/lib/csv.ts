type Cell = string | number | boolean | Date | null | undefined | { toString(): string };

function formatCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  let text = String(value);
  // Impede que folhas de cálculo interpretem o conteúdo como fórmula.
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** CSV com ponto e vírgula e BOM, como o Excel espera em Portugal. */
export function toCsv(headers: string[], rows: Cell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(formatCell).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}

export function csvResponse(fileName: string, body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
