"use server";

import * as XLSX from "xlsx";
import * as officecrypto from "officecrypto-tool";
import type { ParsedVoucherRow, ParseVoucherFileResult } from "@/lib/types/evoucher";

/**
 * Decrypt (if needed) and parse an uploaded UrBox e-voucher Excel file.
 * Node-only work (Buffer/crypto) — does not touch the database. The client
 * takes the returned rows and persists them via evoucherService, the same
 * split used by the CCCD OCR flow (ocrAction.ts + rewardService.ts).
 */
export async function parseVoucherFile(formData: FormData): Promise<ParseVoucherFileResult> {
  try {
    const file = formData.get("file") as File | null;
    if (!file) {
      return { success: false, message: "Vui lòng chọn tệp Excel." };
    }

    const password = (formData.get("password") as string) || "";
    const arrayBuffer = await file.arrayBuffer();
    let buffer: Buffer = Buffer.from(arrayBuffer);

    if (officecrypto.isEncrypted(buffer)) {
      if (!password) {
        return { success: false, message: "Tệp này có mật khẩu bảo vệ. Vui lòng nhập mật khẩu." };
      }
      try {
        buffer = (await officecrypto.decrypt(buffer, { password })) as Buffer;
      } catch {
        return { success: false, message: "Sai mật khẩu. Vui lòng kiểm tra lại." };
      }
    }

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: "buffer" });
    } catch {
      return { success: false, message: "Không thể đọc tệp. Tệp có thể bị hỏng hoặc không đúng định dạng Excel." };
    }

    const rows: ParsedVoucherRow[] = [];
    for (const sheetName of workbook.SheetNames) {
      rows.push(...parseVoucherSheet(workbook.Sheets[sheetName], sheetName));
    }

    if (rows.length === 0) {
      return { success: false, message: "Không tìm thấy dữ liệu voucher hợp lệ trong tệp." };
    }

    return {
      success: true,
      message: `Đã đọc ${rows.length} voucher từ ${workbook.SheetNames.length} sheet.`,
      fileName: file.name,
      rows,
    };
  } catch (error: any) {
    console.error("[evoucherParseAction] Error:", error?.message || error);
    return { success: false, message: error?.message || "Lỗi xử lý tệp." };
  }
}

/**
 * Parses one worksheet into voucher rows.
 * Expected columns (UrBox template): Index | Link Card | Số tiền | Hạn chi tiêu thẻ | Mã PIN
 * The sheet name carries the batch code, e.g. "100000_CI695400001" -> denomination 100000, code CI695400001
 * (the "Số tiền" column is still the source of truth for denomination per row).
 */
function parseVoucherSheet(sheet: XLSX.WorkSheet, sheetName: string): ParsedVoucherRow[] {
  const aoa = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });
  if (aoa.length < 2) return [];

  const header = aoa[0].map((h) => String(h || "").trim().toLowerCase());
  const idxIndex = header.findIndex((h) => h.includes("index"));
  const idxLink = header.findIndex((h) => h.includes("link"));
  const idxAmount = header.findIndex((h) => h.includes("tiền") || h.includes("amount"));
  const idxExpiry = header.findIndex((h) => h.includes("hạn") || h.includes("expiry") || h.includes("date"));
  const idxPin = header.findIndex((h) => h.includes("pin"));

  const sheetNameParts = sheetName.split("_");
  const sheetDenomination = parseInt(sheetNameParts[0], 10) || 0;
  const voucherCode = sheetNameParts.length > 1 ? sheetNameParts.slice(1).join("_") : sheetName;

  const rows: ParsedVoucherRow[] = [];
  for (let i = 1; i < aoa.length; i++) {
    const row = aoa[i];
    const link = idxLink >= 0 ? String(row[idxLink] || "").trim() : "";
    if (!link) continue; // skip blank rows

    const denomination = (idxAmount >= 0 ? Number(row[idxAmount]) : 0) || sheetDenomination;
    const pinRaw = idxPin >= 0 ? String(row[idxPin] || "").trim() : "";
    const rowIndex = (idxIndex >= 0 ? Number(row[idxIndex]) : 0) || i;
    const expiryRaw = idxExpiry >= 0 ? row[idxExpiry] : "";

    rows.push({
      denomination,
      voucher_code: voucherCode,
      row_index: rowIndex,
      link,
      pin: pinRaw || null,
      expiry_date: parseExcelDate(expiryRaw),
    });
  }

  return rows;
}

/** Parses a Vietnamese dd/mm/yyyy string (or an Excel date serial) into an ISO date string. */
function parseExcelDate(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }

  const str = String(value).trim();
  const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}
