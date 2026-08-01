// @/lib/exportExcel.ts
// Shared "Xuất Excel" helper — extracted from the identical
// json_to_sheet -> book_new -> book_append_sheet -> writeFile recipe that
// was previously duplicated locally in app/admin/sessions/page.tsx and
// app/admin/leaderboard/page.tsx. Behavior is unchanged; this just avoids a
// third (and fourth, fifth, sixth...) copy for the new analytics dashboards.
import * as XLSX from "xlsx";

/**
 * Export a single flat table to a one-sheet .xlsx file.
 * `rows` should already be shaped with the exact Vietnamese column headers
 * you want to appear (i.e. map your data to `{ "Tên cột": value, ... }`
 * before calling this), matching the existing pattern in this app.
 */
export function exportSheetToExcel(
  rows: Record<string, unknown>[],
  sheetName: string,
  fileName: string
): void {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, fileName);
}

/** Export multiple tables as separate sheets in one .xlsx file. */
export function exportSheetsToExcel(
  sheets: { name: string; rows: Record<string, unknown>[] }[],
  fileName: string
): void {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  }
  XLSX.writeFile(workbook, fileName);
}
