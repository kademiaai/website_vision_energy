"use client";
import { useState } from "react";
import * as XLSX from "xlsx";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, Download, CheckCircle, AlertCircle, AlertTriangle, Loader2 } from "lucide-react";
import { parseBusinessMetricsSheet, type ParseBusinessFileResult } from "@/lib/businessMetricsParser";
import { businessMetricsService } from "@/app/services/businessMetricsService";
import { supabase } from "@/lib/supabase";

const GRANULARITY_LABELS: Record<string, string> = { day: "Ngày", week: "Tuần", month: "Tháng" };

function downloadTemplate() {
  const rows = [
    ["Tháng", "Doanh thu (VNĐ)", "Điện năng (kWh)"],
    ["2026-01", "50000000", "1200"],
    ["2026-02", "55000000", "1300"],
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "MauDuLieu");
  XLSX.writeFile(workbook, "Mau_hieu_qua_kinh_doanh.xlsx");
}

export default function BusinessUploadModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ParseBusinessFileResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setSaveError(null);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false }) as unknown[][];
      setResult(parseBusinessMetricsSheet(aoa));
    } catch (err) {
      console.error("Lỗi đọc file Excel:", err);
      setResult({
        rows: [],
        duplicateKeys: [],
        missingPeriods: [],
        headerErrors: ["Không thể đọc file. Vui lòng kiểm tra định dạng file .xlsx."],
        hasBlockingErrors: true,
      });
    }
  };

  const handleConfirm = async () => {
    if (!result || result.hasBlockingErrors) return;
    setSaving(true);
    setSaveError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const rows = result.rows
        .filter((r) => r.period && r.granularity && r.revenue !== null && r.energy !== null)
        .map((r) => ({
          period: r.period as string,
          granularity: r.granularity!,
          revenue_vnd: r.revenue as number,
          energy_kwh: r.energy as number,
          source_file_name: fileName,
          uploaded_by: userData.user?.email || null,
        }));

      const saveResult = await businessMetricsService.upsertMany(rows);
      if (!saveResult.success) {
        setSaveError(saveResult.message);
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-start md:items-center justify-center p-4 bg-background/80 backdrop-blur-sm overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-3xl my-8"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-border">
            <h3 className="text-lg font-bold text-foreground">Tải lên dữ liệu kinh doanh</h3>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="p-4 md:p-6 space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium cursor-pointer hover:bg-primary/90 transition-colors">
                <Upload size={16} />
                Chọn file .xlsx
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                />
              </label>
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-muted/70 transition-colors"
              >
                <Download size={16} />
                Tải file mẫu
              </button>
              {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
            </div>

            <p className="text-xs text-muted-foreground">
              Cột bắt buộc: <strong>Tháng</strong> (định dạng YYYY-MM, ví dụ 2026-01), <strong>Doanh thu (VNĐ)</strong>,{" "}
              <strong>Điện năng (kWh)</strong>. Có thể dùng tiêu đề tiếng Anh (Month/Revenue/Energy) và đổi thứ tự cột.
              Cũng chấp nhận dữ liệu theo ngày (YYYY-MM-DD) hoặc theo tuần (YYYY-Www).
            </p>

            {result?.headerErrors && result.headerErrors.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 space-y-1">
                {result.headerErrors.map((e, i) => (
                  <p key={i} className="text-sm text-red-600 flex items-center gap-2">
                    <AlertCircle size={14} />
                    {e}
                  </p>
                ))}
              </div>
            )}

            {result && result.rows.length > 0 && (
              <>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-foreground font-medium">{result.rows.length} dòng</span>
                  <span className="text-red-600">{result.rows.filter((r) => r.errors.length > 0).length} lỗi</span>
                  {result.missingPeriods.length > 0 && (
                    <span className="text-amber-600">{result.missingPeriods.length} kỳ bị thiếu</span>
                  )}
                </div>

                {result.missingPeriods.length > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm text-amber-700 flex items-start gap-2">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span>
                      Thiếu dữ liệu cho: {result.missingPeriods.map((m) => m.period).join(", ")}. Đây chỉ là cảnh báo — vẫn có
                      thể lưu.
                    </span>
                  </div>
                )}

                <div className="admin-table-container max-h-72 overflow-y-auto">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Kỳ báo cáo</th>
                        <th>Loại</th>
                        <th>Doanh thu (VNĐ)</th>
                        <th>Điện năng (kWh)</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row) => (
                        <tr key={row.rowNumber}>
                          <td>{row.period || row.periodRaw}</td>
                          <td>{row.granularity ? GRANULARITY_LABELS[row.granularity] : "—"}</td>
                          <td>{row.revenue !== null ? row.revenue.toLocaleString("vi-VN") : row.revenueRaw}</td>
                          <td>{row.energy !== null ? row.energy.toLocaleString("vi-VN") : row.energyRaw}</td>
                          <td>
                            {row.errors.length === 0 ? (
                              <span className="badge badge-primary bg-green-500/10 text-green-600">
                                <CheckCircle size={12} className="mr-1" /> Hợp lệ
                              </span>
                            ) : (
                              <span className="text-xs text-red-600">{row.errors.join("; ")}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {saveError && <p className="text-sm text-red-500">{saveError}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={onClose} className="px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-muted transition-colors">
                Hủy
              </button>
              <button
                onClick={handleConfirm}
                disabled={!result || result.hasBlockingErrors || saving}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                Xác nhận &amp; Lưu
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
