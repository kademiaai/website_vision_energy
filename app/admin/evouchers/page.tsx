"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Ticket, Upload, ChevronDown, RefreshCw, Lock, XCircle,
  CheckCircle, AlertCircle, ExternalLink, Loader2, Settings2, Plus, Trash,
  RotateCcw, ListChecks, AlertTriangle,
} from "lucide-react";
import { evoucherService } from "@/app/services/evoucherService";
import { rewardService } from "@/app/services/rewardService";
import { getCurrentVietnamPeriod, formatVietnamTime } from "@/lib/timezone";
import type { EVoucher, EVoucherOpenLog, EVoucherTierRule, VoucherInventorySummary } from "@/lib/types/evoucher";
import { supabase } from "@/lib/supabase";

export default function EVouchersPage() {
  const currentPeriod = getCurrentVietnamPeriod();
  const [month, setMonth] = useState(currentPeriod.month);
  const [year, setYear] = useState(currentPeriod.year);

  const [inventory, setInventory] = useState<VoucherInventorySummary[]>([]);
  const [openLogs, setOpenLogs] = useState<(EVoucherOpenLog & { evoucher: EVoucher | null })[]>([]);
  const [allVouchers, setAllVouchers] = useState<EVoucher[]>([]);
  const [selectedVoucherIds, setSelectedVoucherIds] = useState<Set<string>>(new Set());
  const [resetTargets, setResetTargets] = useState<EVoucher[] | null>(null);
  const [resetting, setResetting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [hasUploadThisPeriod, setHasUploadThisPeriod] = useState(true);

  // Upload modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Tier rules settings state
  const [tierRules, setTierRules] = useState<EVoucherTierRule[]>([]);
  const [tierDrafts, setTierDrafts] = useState<Record<string, { minRank: string; maxRank: string; denomination: string }>>({});
  const [newTier, setNewTier] = useState({ minRank: "", maxRank: "", denomination: "" });
  const [savingTierId, setSavingTierId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Reclaim any assigned voucher whose expiry (end of assigned month) has
      // passed and was never opened, before reading the current state.
      await evoucherService.expireOverdueVouchers();

      const [inv, logs, hasUpload, rules, vouchers] = await Promise.all([
        evoucherService.getInventorySummary(),
        evoucherService.getOpenLogs(50),
        evoucherService.hasUploadForPeriod(currentPeriod.month, currentPeriod.year),
        evoucherService.getTierRules(),
        evoucherService.getAllVouchers(),
      ]);
      setInventory(inv);
      setOpenLogs(logs);
      setHasUploadThisPeriod(hasUpload);
      setAllVouchers(vouchers);
      setTierRules(rules);
      // Only seed a draft the first time a rule is seen — loadData() re-runs
      // after almost every admin action (upload, reset, other rule saves),
      // so overwriting existing drafts unconditionally would wipe whatever
      // an admin was mid-typing in a different rule's row.
      setTierDrafts((prev) =>
        Object.fromEntries(
          rules.map((r) => [
            r.id,
            prev[r.id] ?? { minRank: String(r.min_rank), maxRank: String(r.max_rank), denomination: String(r.denomination) },
          ])
        )
      );
    } catch (err) {
      console.error("Lỗi tải dữ liệu e-voucher:", err);
    } finally {
      setLoading(false);
    }
  }, [currentPeriod.month, currentPeriod.year]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (mounted) setAdminEmail(data.user?.email || null);
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const resetUploadState = () => {
    setFile(null);
    setPassword("");
    setUploadMessage(null);
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadMessage({ type: "error", text: "Vui lòng chọn tệp Excel." });
      return;
    }

    setUploading(true);
    setUploadMessage(null);
    try {
      const { parseVoucherFile } = await import("@/app/services/evoucherParseAction");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("password", password);

      const parsed = await parseVoucherFile(formData);
      if (!parsed.success || !parsed.rows) {
        setUploadMessage({ type: "error", text: parsed.message });
        setUploading(false);
        return;
      }

      const result = await evoucherService.importParsedVouchers(
        parsed.rows,
        parsed.fileName || file.name,
        month,
        year,
        adminEmail || undefined
      );

      setUploadMessage({ type: result.success ? "success" : "error", text: result.message });
      if (result.success) {
        await loadData();
      }
    } catch (err: any) {
      console.error("Lỗi tải lên e-voucher:", err);
      setUploadMessage({ type: "error", text: err?.message || "Lỗi hệ thống." });
    } finally {
      setUploading(false);
    }
  };

  const totalAvailable = inventory.reduce((sum, i) => sum + i.available, 0);

  const handleSaveTierRule = async (id: string) => {
    const draft = tierDrafts[id];
    const minRank = Number(draft?.minRank);
    const maxRank = Number(draft?.maxRank);
    const denomination = Number(draft?.denomination);

    if (!minRank || !maxRank || !denomination || maxRank < minRank) {
      alert("Vui lòng nhập hạng và mệnh giá hợp lệ (hạng đến >= hạng từ).");
      return;
    }

    setSavingTierId(id);
    try {
      const result = await evoucherService.updateTierRule(id, { minRank, maxRank, denomination });
      if (!result.success) {
        alert(result.message);
        return;
      }
      await loadData();
    } finally {
      setSavingTierId(null);
    }
  };

  const handleDeleteTierRule = async (id: string) => {
    if (!confirm("Xóa quy tắc này?")) return;
    const result = await evoucherService.deleteTierRule(id);
    if (!result.success) {
      alert(result.message);
      return;
    }
    await loadData();
  };

  const handleAddTierRule = async () => {
    const minRank = Number(newTier.minRank);
    const maxRank = Number(newTier.maxRank);
    const denomination = Number(newTier.denomination);

    if (!minRank || !maxRank || !denomination || maxRank < minRank) {
      alert("Vui lòng nhập hạng và mệnh giá hợp lệ (hạng đến >= hạng từ).");
      return;
    }

    const result = await evoucherService.addTierRule(minRank, maxRank, denomination);
    if (!result.success) {
      alert(result.message);
      return;
    }
    setNewTier({ minRank: "", maxRank: "", denomination: "" });
    await loadData();
  };

  const resettableVouchers = allVouchers.filter((v) => v.status !== "available");

  const toggleSelectVoucher = (id: string) => {
    setSelectedVoucherIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVouchers = () => {
    if (selectedVoucherIds.size === resettableVouchers.length && resettableVouchers.length > 0) {
      setSelectedVoucherIds(new Set());
    } else {
      setSelectedVoucherIds(new Set(resettableVouchers.map((v) => v.id)));
    }
  };

  const openResetModal = (vouchers: EVoucher[]) => setResetTargets(vouchers);

  const handleConfirmReset = async (deleteRewardHistory: boolean) => {
    if (!resetTargets || resetTargets.length === 0) return;
    setResetting(true);
    try {
      for (const v of resetTargets) {
        if (deleteRewardHistory && v.assigned_license_plate && v.assigned_month && v.assigned_year) {
          const reward = await rewardService.getRewardByPlateAndPeriod(v.assigned_license_plate, v.assigned_month, v.assigned_year);
          if (reward) {
            await rewardService.deleteReward(reward.id, adminEmail || undefined);
          }
        }
        await evoucherService.resetVoucherToAvailable(v.id);
      }
      setResetTargets(null);
      setSelectedVoucherIds(new Set());
      await loadData();
    } finally {
      setResetting(false);
    }
  };

  const voucherStatusBadge = (status: EVoucher["status"]) => {
    switch (status) {
      case "available":
        return <span className="badge bg-muted text-muted-foreground">Mới</span>;
      case "assigned":
        return <span className="badge bg-blue-500/10 text-blue-500">Đã gán</span>;
      case "opened":
        return <span className="badge bg-green-500/10 text-green-600">Đã mở quà</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="admin-card">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
              <Ticket size={24} className="text-primary" />
              Kho E-voucher
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Tải lên thẻ quà UrBox hàng tháng và theo dõi trạng thái sử dụng
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              className={`p-2.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors ${loading ? "animate-spin" : ""}`}
              disabled={loading}
            >
              <RefreshCw size={18} />
            </button>
            <button
              onClick={() => {
                resetUploadState();
                setUploadModalOpen(true);
              }}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              <Upload size={18} />
              Tải lên Excel
            </button>
          </div>
        </div>

        {!hasUploadThisPeriod && (
          <div className="mt-4 flex items-center gap-2 text-amber-600 bg-amber-500/10 p-3 rounded-lg text-sm">
            <AlertCircle size={16} />
            Chưa có tệp e-voucher nào được tải lên cho tháng {currentPeriod.month}/{currentPeriod.year}. Vui lòng tải lên tệp UrBox của tháng này.
          </div>
        )}
      </div>

      {/* Inventory */}
      <div className="admin-card">
        <h2 className="text-lg font-bold text-foreground mb-4">Tồn kho theo mệnh giá</h2>
        {inventory.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">
            {loading ? "Đang tải..." : "Chưa có e-voucher nào trong kho."}
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {inventory.map((item) => (
              <div key={item.denomination} className="bg-muted/30 rounded-xl border border-border/50 p-4">
                <p className="text-xs font-bold text-muted-foreground uppercase mb-2">
                  {item.denomination.toLocaleString("vi-VN")}đ
                </p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Còn lại</span>
                    <span className="font-bold text-foreground">{item.available}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Đã gán</span>
                    <span className="font-medium text-blue-600">{item.assigned}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Đã mở</span>
                    <span className="font-medium text-green-600">{item.opened}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {inventory.length > 0 && (
          <p className="text-xs text-muted-foreground mt-3">
            Tổng cộng còn <strong>{totalAvailable}</strong> voucher khả dụng. Gán voucher cho khách hàng tại trang{" "}
            <a href="/admin/leaderboard" className="text-primary underline">Xếp hạng &amp; Thưởng</a>.
          </p>
        )}
      </div>

      {/* Detailed voucher list */}
      <div className="admin-card p-0">
        <div className="p-4 md:p-6 pb-0">
          <h2 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
            <ListChecks size={18} className="text-primary" />
            Chi tiết từng voucher
          </h2>
          <p className="text-muted-foreground text-sm mb-4">
            Trạng thái từng voucher trong kho. Di chuột vào một dòng để xem link rút gọn, nhấn "Kiểm tra" để mở link đầy đủ.
          </p>
        </div>

        {selectedVoucherIds.size > 0 && (
          <div className="p-4 bg-primary/5 border-y border-border flex items-center justify-between">
            <span className="text-sm text-foreground">
              Đã chọn <strong>{selectedVoucherIds.size}</strong> voucher
            </span>
            <button
              onClick={() => openResetModal(allVouchers.filter((v) => selectedVoucherIds.has(v.id)))}
              className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/70 transition-colors text-sm font-medium"
            >
              <RotateCcw size={16} />
              Đặt lại Mới ({selectedVoucherIds.size})
            </button>
          </div>
        )}

        <div className="admin-table-container border-0">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedVoucherIds.size === resettableVouchers.length && resettableVouchers.length > 0}
                    onChange={toggleSelectAllVouchers}
                    className="rounded border-border"
                  />
                </th>
                <th className="px-4 py-3">Mệnh giá</th>
                <th className="px-4 py-3 text-center">Trạng thái</th>
                <th className="px-4 py-3">Biển số gán</th>
                <th className="px-4 py-3 hidden md:table-cell">Gán lúc</th>
                <th className="px-4 py-3 hidden lg:table-cell">Mở lúc</th>
                <th className="px-4 py-3 text-center hidden lg:table-cell">Số lần mở</th>
                <th className="px-4 py-3">Link</th>
                <th className="px-4 py-3 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {allVouchers.map((v) => (
                <tr key={v.id} title={`Link: ...${v.link.slice(-14)}`}>
                  <td className="px-4 py-3">
                    {v.status !== "available" && (
                      <input
                        type="checkbox"
                        checked={selectedVoucherIds.has(v.id)}
                        onChange={() => toggleSelectVoucher(v.id)}
                        className="rounded border-border"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 font-bold text-foreground">{v.denomination.toLocaleString("vi-VN")}đ</td>
                  <td className="px-4 py-3 text-center">{voucherStatusBadge(v.status)}</td>
                  <td className="px-4 py-3">
                    {v.assigned_license_plate ? (
                      <span className="font-mono font-bold text-primary text-sm">{v.assigned_license_plate}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                    {v.assigned_at ? formatVietnamTime(v.assigned_at) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                    {v.first_opened_at ? formatVietnamTime(v.first_opened_at) : "—"}
                  </td>
                  <td className="px-4 py-3 text-center hidden lg:table-cell">{v.open_count}</td>
                  <td className="px-4 py-3">
                    <a
                      href={v.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={v.link}
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Kiểm tra <ExternalLink size={12} />
                    </a>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {v.status !== "available" && (
                      <button
                        onClick={() => openResetModal([v])}
                        className="flex items-center gap-1 mx-auto px-2.5 py-1 rounded-lg bg-muted text-muted-foreground hover:bg-muted/70 transition-colors text-xs font-medium disabled:opacity-50"
                        title="Đặt lại về Mới"
                      >
                        <RotateCcw size={12} />
                        Đặt lại Mới
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {allVouchers.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    <Ticket className="w-12 h-12 mx-auto mb-2 text-border" />
                    <p>Chưa có voucher nào trong kho.</p>
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tier rules settings */}
      <div className="admin-card">
        <h2 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
          <Settings2 size={18} className="text-primary" />
          Quy tắc gán theo hạng
        </h2>
        <p className="text-muted-foreground text-sm mb-4">
          Xác định mệnh giá e-voucher cho từng khoảng hạng. Áp dụng cho gợi ý mặc định và gán hàng loạt trên trang Xếp hạng &amp; Thưởng.
        </p>

        <div className="space-y-2">
          {tierRules.map((rule) => {
            const draft = tierDrafts[rule.id] || { minRank: "", maxRank: "", denomination: "" };
            return (
              <div key={rule.id} className="flex flex-wrap items-center gap-2 p-3 bg-muted/30 rounded-lg border border-border/50">
                <span className="text-sm text-muted-foreground">Hạng</span>
                <input
                  type="number"
                  min={1}
                  value={draft.minRank}
                  onChange={(e) => setTierDrafts((prev) => ({ ...prev, [rule.id]: { ...draft, minRank: e.target.value } }))}
                  className="admin-input w-20 text-center"
                />
                <span className="text-sm text-muted-foreground">đến</span>
                <input
                  type="number"
                  min={1}
                  value={draft.maxRank}
                  onChange={(e) => setTierDrafts((prev) => ({ ...prev, [rule.id]: { ...draft, maxRank: e.target.value } }))}
                  className="admin-input w-20 text-center"
                />
                <span className="text-sm text-muted-foreground">&rarr; mệnh giá</span>
                <input
                  type="number"
                  min={1}
                  step={1000}
                  value={draft.denomination}
                  onChange={(e) => setTierDrafts((prev) => ({ ...prev, [rule.id]: { ...draft, denomination: e.target.value } }))}
                  className="admin-input w-28 text-center"
                />
                <span className="text-sm text-muted-foreground">đ</span>
                <div className="flex items-center gap-1 ml-auto">
                  <button
                    onClick={() => handleSaveTierRule(rule.id)}
                    disabled={savingTierId === rule.id}
                    className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >
                    {savingTierId === rule.id ? "Đang lưu..." : "Lưu"}
                  </button>
                  <button
                    onClick={() => handleDeleteTierRule(rule.id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                    title="Xóa quy tắc"
                  >
                    <Trash size={14} className="text-red-500" />
                  </button>
                </div>
              </div>
            );
          })}

          {tierRules.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground py-4 text-center">Chưa có quy tắc nào.</p>
          )}

          {/* Add new rule */}
          <div className="flex flex-wrap items-center gap-2 p-3 border border-dashed border-border rounded-lg">
            <span className="text-sm text-muted-foreground">Hạng</span>
            <input
              type="number"
              min={1}
              placeholder="VD: 16"
              value={newTier.minRank}
              onChange={(e) => setNewTier((prev) => ({ ...prev, minRank: e.target.value }))}
              className="admin-input w-20 text-center"
            />
            <span className="text-sm text-muted-foreground">đến</span>
            <input
              type="number"
              min={1}
              placeholder="VD: 20"
              value={newTier.maxRank}
              onChange={(e) => setNewTier((prev) => ({ ...prev, maxRank: e.target.value }))}
              className="admin-input w-20 text-center"
            />
            <span className="text-sm text-muted-foreground">&rarr; mệnh giá</span>
            <input
              type="number"
              min={1}
              step={1000}
              placeholder="VD: 50000"
              value={newTier.denomination}
              onChange={(e) => setNewTier((prev) => ({ ...prev, denomination: e.target.value }))}
              className="admin-input w-28 text-center"
            />
            <span className="text-sm text-muted-foreground">đ</span>
            <button
              onClick={handleAddTierRule}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors ml-auto"
            >
              <Plus size={14} />
              Thêm quy tắc
            </button>
          </div>
        </div>
      </div>

      {/* Open logs */}
      <div className="admin-card p-0">
        <div className="p-4 md:p-6 pb-0">
          <h2 className="text-lg font-bold text-foreground mb-1">Lịch sử mở e-voucher</h2>
          <p className="text-muted-foreground text-sm mb-4">Mỗi lần khách hàng nhấn mở thẻ quà đều được ghi lại tại đây</p>
        </div>
        <div className="admin-table-container border-0">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3">Biển số</th>
                <th className="px-4 py-3 text-center">Mệnh giá</th>
                <th className="px-4 py-3">Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {openLogs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatVietnamTime(log.opened_at)}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono font-bold text-primary text-sm">{log.license_plate}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {log.evoucher ? (
                      <span className="badge bg-primary/10 text-primary">
                        {log.evoucher.denomination.toLocaleString("vi-VN")}đ
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {log.evoucher?.link ? (
                      <a
                        href={log.evoucher.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Xem thẻ <ExternalLink size={12} />
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </td>
                </tr>
              ))}

              {openLogs.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                    <Ticket className="w-12 h-12 mx-auto mb-2 text-border" />
                    <p>Chưa có e-voucher nào được mở.</p>
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reset voucher confirmation modal */}
      {resetTargets && resetTargets.length > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-card rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <RotateCcw size={18} className="text-primary" />
                Đặt lại {resetTargets.length > 1 ? `${resetTargets.length} voucher` : "voucher"} về Mới
              </h3>
              <button
                onClick={() => {
                  if (resetting) return;
                  setResetTargets(null);
                }}
                className="p-1 rounded hover:bg-muted"
              >
                <XCircle size={16} />
              </button>
            </div>

            <div className="max-h-40 overflow-y-auto space-y-1 mb-4">
              {resetTargets.map((v) => (
                <div key={v.id} className="flex justify-between text-xs bg-muted/30 rounded px-2 py-1.5">
                  <span className="font-mono font-bold text-primary">{v.assigned_license_plate || "—"}</span>
                  <span className="text-muted-foreground">{v.denomination.toLocaleString("vi-VN")}đ · {voucherStatusBadge(v.status)}</span>
                </div>
              ))}
            </div>

            <div className="flex items-start gap-2 text-amber-600 bg-amber-500/10 p-3 rounded-lg text-sm mb-4">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>
                Bạn có muốn xóa luôn lịch sử thưởng (rewards) của khách hàng cho kỳ gán voucher này không? Nếu có, trạng thái thưởng của họ sẽ trở về "chưa được thưởng".
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleConfirmReset(true)}
                disabled={resetting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {resetting ? <Loader2 size={16} className="animate-spin" /> : <Trash size={16} />}
                Xóa lịch sử thưởng &amp; đặt lại Mới
              </button>
              <button
                onClick={() => handleConfirmReset(false)}
                disabled={resetting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-muted/70 transition-colors disabled:opacity-50"
              >
                {resetting ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                Chỉ đặt lại voucher (giữ lịch sử thưởng)
              </button>
              <button
                onClick={() => setResetTargets(null)}
                disabled={resetting}
                className="w-full px-4 py-2 rounded-lg border border-border text-sm"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-card rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Upload size={18} className="text-primary" />
                Tải lên tệp e-voucher
              </h3>
              <button
                onClick={() => {
                  if (uploading) return;
                  setUploadModalOpen(false);
                }}
                className="p-1 rounded hover:bg-muted"
              >
                <XCircle size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 w-full">
                <div className="relative flex-1">
                  <select
                    className="admin-select pl-3 pr-8 py-2 appearance-none w-full"
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                </div>
                <div className="relative flex-1">
                  <select
                    className="admin-select pl-3 pr-8 py-2 appearance-none w-full"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                  >
                    {[2025, 2026, 2027].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Tệp Excel (UrBox)</label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="admin-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                  <Lock size={14} /> Mật khẩu tệp (nếu có)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Để trống nếu tệp không có mật khẩu"
                  className="admin-input"
                />
              </div>

              {uploadMessage && (
                <div
                  className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                    uploadMessage.type === "success" ? "text-green-600 bg-green-500/10" : "text-red-500 bg-red-500/10"
                  }`}
                >
                  {uploadMessage.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                  {uploadMessage.text}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setUploadModalOpen(false)}
                disabled={uploading}
                className="px-4 py-2 rounded-lg border border-border"
              >
                Đóng
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !file}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50 flex items-center gap-2"
              >
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {uploading ? "Đang xử lý..." : "Tải lên"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
