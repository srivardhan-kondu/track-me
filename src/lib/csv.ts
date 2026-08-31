/**
 * CSV serialisation for the data export.
 *
 * Lives apart from the route so the escaping rules — the part with a security
 * consequence — can be tested directly.
 */

/**
 * Spreadsheets treat a leading =, +, - or @ as the start of a formula, so a
 * value that begins with one is executable code in Excel, Sheets and Numbers
 * rather than text.
 *
 * That matters here because the content is not ours: meal titles and
 * transcripts come from a vision model reading a user's own photo and voice
 * note, and the resulting file is most often opened by that user's coach. A
 * leading apostrophe is the conventional defusal — spreadsheets read it as
 * "treat the rest as text" and do not display it.
 */
export function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** One CSV cell: formula-defused, then quoted if it would break the row. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const raw = value instanceof Date ? value.toISOString() : String(value);
  const safe = neutralizeFormula(raw);
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** A full CSV document. Headers come from the first row's keys. */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvCell(row[h])).join(","));
  }
  return lines.join("\n");
}
