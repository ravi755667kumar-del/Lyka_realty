/** Escape quotes and neutralize spreadsheet formula injection in CRM exports. */
export function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
